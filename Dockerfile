FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    python3 \
    python3-pip && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
