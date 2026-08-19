# --- Multi-stage Production Dockerfile ---
# Stage 1: Build React Vite Frontend
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Setup Node.js Server & Dependencies
FROM node:20-alpine AS production
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy server source code and database migrations
COPY server/ ./server/

# Copy compiled frontend from client-builder
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port and configure environment
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Start unified CheckPoint server
CMD ["node", "server/src/index.js"]
