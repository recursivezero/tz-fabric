import os
import boto3
from datetime import datetime
from xmlrpc.client import Boolean
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from constants import CDN_URL

s3_client = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)
AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")
# optional CDN/domain

# s3_client = boto3.client("s3", region_name=AWS_REGION)


def upload_file(
    file_obj, key: str, bucket_name: str | None = AWS_BUCKET_NAME
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
        file_obj.seek(0)

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
    key: str, expires: int = 3600, bucket_name: str | None = AWS_BUCKET_NAME
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
    REGION = "ap-south-1"

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
            endpoint_url=f"https://s3.{REGION}.amazonaws.com",
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
