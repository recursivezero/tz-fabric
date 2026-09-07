import hashlib
import hmac
import io
import time
import boto3
from datetime import datetime
from xmlrpc.client import Boolean
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from constants import (
    CDN_URL,
    ENVIRONMENT,
    IMAGE_SIGNING_SECRET,
    R2_ACCESS_KEY_ID,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
)

print(f"Environment: {ENVIRONMENT}")
print(f"R2 bucket: {R2_BUCKET_NAME}")
print(f"R2 endpoint: {R2_ENDPOINT}")


# s3_client = boto3.client(
#    "s3",
#    region_name=os.getenv("AWS_REGION"),
#    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
#    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
# )
# AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")
# optional CDN/domain


s3_client = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    region_name=R2_REGION,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"},
    ),
)


def upload_file(
    file_obj, key: str, bucket_name: str | None = R2_BUCKET_NAME
) -> Boolean:
    """
    Upload a file-like object to S3.

    Args:
        file_obj: file-like object (UploadFile.file)
        key: S3 object key (e.g. images/file.jpg)
        bucket_name: Name of the S3 bucket

    Returns:
        Public URL of uploaded object
    """
    try:
        # ✅ CASE 1: bytes → convert to file-like
        if isinstance(file_obj, bytes):
            file_obj = io.BytesIO(file_obj)

        # ✅ CASE 2: UploadFile → use .file (sync object)
        elif hasattr(file_obj, "file"):
            file_obj = file_obj.file

        # ❌ DO NOT use seek on async object

        s3_client.upload_fileobj(
            file_obj,
            bucket_name,
            key,
            ExtraArgs={
                "ContentType": "application/octet-stream",
            },
        )

        return True

    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"S3 upload failed: {e}")


def generate_cdn_url(object_key: str) -> str:
    return f"{CDN_URL}/{object_key}"


def generate_presigned_url(
    key: str, expires: int = 3600, bucket_name: str | None = R2_BUCKET_NAME
) -> dict:
    """
    Generate a presigned GET URL for an S3 object.

    Args:
        key: S3 object key (e.g. resumes/file.pdf)
        expires: expiry time in seconds (default: 1 hour)
        bucket_name: Name of the S3 bucket

    Returns:
        Dict with signed URL string and generation timestamp
    """
    REGION = R2_REGION

    config = Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"},
        region_name=REGION,
    )

    try:
        # Always use the regional endpoint — never the global one for SigV4
        s3_client = boto3.client(
            "s3",
            region_name=REGION,
            config=config,
            # Regional endpoint ensures SigV4 signing matches URL host
            endpoint_url=R2_ENDPOINT,
        )
        # --- DEBUG: remove this block once confirmed working ---
        try:
            s3_client.head_object(Bucket=bucket_name, Key=key)
            print(f"✅ Key exists: {key}")
        except ClientError as e:
            code = e.response["Error"]["Code"]
            print(f"❌ Key check failed [{code}]: bucket={bucket_name}, key={key}")
            raise RuntimeError(
                f"Object not found — bucket: {bucket_name}, key: {key}, code: {code}"
            )
        # -------------------------------------------------------

        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=expires,
        )

        return {"url": url, "generated_at": datetime.now().isoformat()}

    except ClientError as e:
        # Gives you the actual AWS error code, much more debuggable
        raise RuntimeError(
            f"AWS error generating presigned URL: {e.response['Error']['Code']} - {e.response['Error']['Message']}"
        )
    except Exception as e:
        raise RuntimeError(f"Failed to generate presigned URL: {e}")


def create_signed_image_url(
    key: str,
    expires_in_seconds: int = 600,
) -> str:
    if not IMAGE_SIGNING_SECRET:
        raise ValueError("IMAGE_SIGNING_SECRET is not configured")

    expires = int(time.time()) + expires_in_seconds
    data = f"{expires}:{key}"

    signature = hmac.new(
        IMAGE_SIGNING_SECRET.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{CDN_URL.rstrip('/')}/{key}?access={expires}.{signature}"
