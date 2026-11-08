ARG HERMES_IMAGE
FROM ${HERMES_IMAGE}
ARG WHEEL_FILENAME
ARG WHEEL_SHA256
COPY wheel /tmp/wheel
RUN /opt/hermes/.venv/bin/python -m ensurepip && /opt/hermes/.venv/bin/python -m pip install --no-deps "zapbip-platform @ file:///tmp/wheel/${WHEEL_FILENAME}#sha256=${WHEEL_SHA256}"
