FROM docker.io/denoland/deno:2.6.9@sha256:f8ab6f2ae57ae267f2738d3569e624e7844b98268aab0a1c7aef0ba10ef953b0

USER root
WORKDIR /app
ADD --checksum=sha256:81f67e6823597360636feb49f635ee7d6c8021e04a368f897d2a0757957c4273 \
  https://github.com/vrtmrz/livesync-bridge/archive/c3760beaa0851214da4860903445d7f6420ca025.tar.gz /tmp/source.tar.gz
COPY overlay/ /tmp/overlay/
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 -C /app \
 && cp /tmp/overlay/* /app/ \
 && mkdir -p /deno-dir/location_data \
 && chown -R deno:deno /app /deno-dir/location_data \
 && rm -rf /tmp/source.tar.gz /tmp/overlay
USER deno
ENV DENO_DIR=/deno-dir
RUN deno install --frozen && deno cache --frozen main.ts
CMD ["deno", "run", "--cached-only", "-A", "main.ts"]
