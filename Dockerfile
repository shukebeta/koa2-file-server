# Build stage
FROM node:20-alpine AS build-stage
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy the rest of the application code
COPY ./src ./src

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml .env .sequelizerc ./

# Install all dependencies
RUN pnpm install

# Prune devDependencies
RUN pnpm prune --prod

# Production stage
FROM node:20-alpine AS production-stage
WORKDIR /app

# Copy necessary files and production dependencies from build stage
COPY --from=build-stage /app/package.json /app/pnpm-lock.yaml /app/.env /app/.sequelizerc ./
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/src ./src

EXPOSE 3000
CMD ["node", "./src/fileServer/index.js"]
