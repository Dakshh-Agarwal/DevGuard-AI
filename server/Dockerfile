FROM node:20-alpine

# Install Python3 + pip for Pylint (used in Python code analysis)
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages pylint

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install Node.js dependencies
RUN npm ci --production

# Copy application source
COPY . .

# Create temp directory for file uploads
RUN mkdir -p temp

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider --quiet http://localhost:5000/api/github/test || exit 1

CMD ["node", "index.js"]
