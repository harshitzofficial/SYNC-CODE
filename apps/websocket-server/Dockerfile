FROM node:18 as builder
WORKDIR /build
COPY package*.json ./
RUN npm install
COPY src/ src/
COPY tsconfig.json tsconfig.json
RUN npm install --save-dev typescript
RUN npm run build 


FROM node:18 as runner
COPY --from=builder build/package*.json .
COPY --from=builder build/node_modules node_modules/
COPY --from=builder build/dist dist/
EXPOSE 5000
CMD ["npm", "run", "start"]
