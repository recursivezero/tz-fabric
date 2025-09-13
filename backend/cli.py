# cli.py
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()


Port = int(os.getenv("PORT"))


def app():
    uvicorn.run("main:app", host="127.0.0.1", port=Port, reload=True)
