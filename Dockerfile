FROM alpine:latest
EXPOSE 3004
WORKDIR /gitlang
COPY . .
COPY init.sh /bin
RUN rm /gitlang/init.sh
RUN chmod +x /bin/init.sh
ENTRYPOINT "init.sh"
