# Use an official Node.js base image with Chrome support
FROM node:20

# Set working directory
WORKDIR /app

# Install Puppeteer dependencies for headless Chrome
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    libxss1 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./

# Disable Puppeteer's Chromium download (optional if you're using system Chrome)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm install

# Copy source files
COPY . .

# Expose port used by your app
EXPOSE 3000

# Start app with npm run dev
CMD ["npm", "run", "dev"]
# Set the default command to run your app