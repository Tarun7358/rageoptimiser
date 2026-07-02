FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package.json for monorepo (if needed)
COPY package.json .

# Copy backend
COPY backend ./backend

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 5000 5001

# Start the application
CMD ["npm", "start"]
