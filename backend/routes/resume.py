import boto3
from botocore.exceptions import ClientError
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

from utils.aws_helper import upload_file
from utils.filename import sanitize_filename


router = APIRouter()

# Resume upload and retrieval routes
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
RESUME_FOLDER = "resumes"  # change here only if folder renamed
RESUME_BUCKET = "recursivezero"  # S3 bucket name for resumes


@router.post("/resume/upload")
async def upload_resume(
    resume: UploadFile = File(...),
    name: str | None = Form(None),
):
    if not resume.filename:
        raise HTTPException(400, "Missing filename")

    ext = Path(resume.filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only PDF, DOC, DOCX allowed")

    use_name = name.strip() if name and name.strip() else None
    source = use_name if use_name else resume.filename
    base_name = sanitize_filename(source)

    # uses RESUME_FOLDER constant — not hardcoded string
    key = f"{RESUME_FOLDER}/{base_name}{ext}"

    resume.file.seek(0)

    if not upload_file(resume.file, key, bucket_name=RESUME_BUCKET):
        raise HTTPException(500, "Upload failed")

    # presigned = generate_presigned_url(key, expires=3600, bucket_name=RESUME_BUCKET)

    return {
        "message": "Resume Uploaded Successfully.",
        "key": key.split("/")[-1],  # return only filename, not folder path
        # "url": presigned["url"],
        # "generated_at": presigned["generated_at"]
    }


# @router.get("/resume/url")
# async def get_resume_url(key: str):
#     full_key = f"{RESUME_FOLDER}/{key}"  # folder never exposed to caller
#     presigned = generate_presigned_url(full_key, expires=3600, bucket_name=RESUME_BUCKET)
#     return {
#         "url": presigned["url"],
#         "generated_at": presigned["generated_at"]
#     }


@router.get("/admin/resume/fetch")
async def download_resume(key: str, response_class=StreamingResponse):

    full_key = f"{RESUME_FOLDER}/{key}"  # folder never exposed to caller

    s3_client = boto3.client("s3", region_name="ap-south-1")

    try:
        response = s3_client.get_object(Bucket=RESUME_BUCKET, Key=full_key)

        return StreamingResponse(
            response["Body"].iter_chunks(),
            media_type=response["ContentType"],
            headers={
                "Content-Disposition": f"attachment; filename={key}"  # key is already just filename
            },
        )
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        raise HTTPException(404, f"File not found: {error_code}")


@router.get("/resume/access")
async def test_resume_access():
    """
    A simple endpoint to verify the API key is working
    without needing to upload a file.
    """
    return {
        "status": "success",
        "message": "You have accessed the protected resume router!",
    }
