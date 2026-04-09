FROM node:18

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install GCC (for C++)
RUN apt-get update && apt-get install -y build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Go
RUN apt-get update && apt-get install -y golang && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Run as non-root user
RUN useradd -m myuser && chown -R myuser:myuser /usr/src/app
USER myuser

CMD [ "node", "dist/index.js" ]