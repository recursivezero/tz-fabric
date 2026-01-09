# routes/contact.py
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from datetime import datetime

router = APIRouter()


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/contact")
async def save_contact(request: Request, form: ContactForm):
    db = request.app.database  # ← SAME as all other route files

    collection = db["contact_messages"]

    data = {
        "name": form.name,
        "email": form.email,
        "message": form.message,
        "created_at": datetime.utcnow(),
    }

    result = collection.insert_one(data)
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to save message")

    return {"success": True, "id": str(result.inserted_id)}
