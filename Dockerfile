FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim

ARG GODOT_VERSION=4.5.1-stable
ARG GODOT_PACKAGE=Godot_v4.5.1-stable_mono_linux_x86_64

ENV DEBIAN_FRONTEND=noninteractive
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
ENV DOTNET_NOLOGO=1
ENV HOME=/root
ENV GODOT_BIN=/usr/local/bin/godot

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        fonts-noto-cjk \
        libfontconfig1 \
        libfreetype6 \
        python3 \
        python3-pip \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
      "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/${GODOT_PACKAGE}.zip" \
      -o /tmp/godot.zip \
    && unzip -q /tmp/godot.zip -d /opt \
    && ln -s "/opt/${GODOT_PACKAGE}/Godot_v4.5.1-stable_mono_linux.x86_64" /usr/local/bin/godot \
    && chmod +x /usr/local/bin/godot \
    && rm /tmp/godot.zip

WORKDIR /app
COPY mod-builder/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

COPY mod-builder/ /app/

EXPOSE 80
CMD ["python3", "/app/service.py"]
