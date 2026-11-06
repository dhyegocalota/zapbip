ARG HERMES_IMAGE
FROM ${HERMES_IMAGE}
COPY wheel /tmp/wheel
RUN /opt/hermes/.venv/bin/python -m ensurepip && /opt/hermes/.venv/bin/python -m pip install --no-deps /tmp/wheel/*.whl
