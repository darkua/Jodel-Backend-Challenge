FROM debian:stable-slim
RUN apt-get update  
RUN apt-get install -y ca-certificates
ADD ab_linux_amd64 /ab
CMD ["/ab","demo","5"]