from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import analysis, regenerate, validate_image


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/api")
app.include_router(regenerate.router, prefix="/api")
app.include_router(validate_image.router, prefix="/api")

@app.get("/")
def root():
    return {"Gemini Fabric analyzer"}