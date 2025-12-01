# TZ-Fabric

## How to start

```sh
poetry install
```

create `.env` file and add content from `.env.local` file anc change value according to your project

Note: according to your port change the port in `frontend/vite.config.ts` and `VITE_API_URL`

```sh
poetry shell
poetry run dev
```

## Lint

to lint the code run

```sh
poetry run black .
#then
poetry run ruff .
```

open [http://localhost:8000](http://127.0.0.1:8000)

## Build

```sh
poetry build
```

This will create a dist folder in which there will be two files .gz and .whl

now create virtual environment and install package

```sh
python -m venv .venv-dist
source .venv-dist/bin/activate
pip install dist/*.whl 
```

install heavy dependencies separately

```sh
pip install tz-fabric[extra]
poetry run dev
```