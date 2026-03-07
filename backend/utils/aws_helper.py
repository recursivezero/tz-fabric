import os
import boto3
from botocore.exceptions import BotoCoreError, ClientError

s3_client = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)
AWS_REGION = os.getenv("AWS_REGION")
AWS_BUCKET = os.getenv("AWS_BUCKET")
AWS_PUBLIC_URL = os.getenv("AWS_PUBLIC_URL")  # optional CDN/domain

s3_client = boto3.client("s3", region_name=AWS_REGION)


def upload_file(file_obj, key: str) -> str:
    """
    Upload a file-like object to S3.

    Args:
        file_obj: file-like object (UploadFile.file)
        key: S3 object key (e.g. images/file.jpg)

    Returns:
        Public URL of uploaded object
    """

    try:
        file_obj.seek(0)

        s3_client.upload_fileobj(
            file_obj,
            AWS_BUCKET,
            key,
            ExtraArgs={
                "ContentType": "application/octet-stream",
            },
        )

        return True

    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"S3 upload failed: {e}")
