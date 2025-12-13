# TZ-Fabric: Backend

## How to start

```sh
poetry install
poetry install --all-extras
```

create `.env` file and add content from `.env.local` file anc change value according to your project

Note: according to your port change the port in `frontend/vite.config.ts` and `VITE_API_URL`

```sh
poetry shell
poetry run tzfabric dev
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

## Deployment

- Clone the repo
- run `poetry install` ( make sure poetry installed; if not then install it)
- create a file on `/etc/systemd/system/tz-fabric.service`  and copy the content of [this file]('./cloud.service) ; make sure change the path of project where ever it is in your cloud
- use `which poetry` to know poetry path adn add that 

run

```sh
sudo systemctl daemon-reload
sudo systemctl start tz-fabric
sudo systemctl status tz-fabric
```

last command will should display active and running in the output; if it is not then check for the error log 