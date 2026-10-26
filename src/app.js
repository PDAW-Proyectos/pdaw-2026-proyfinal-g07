import express from "express";
import { fileURLToPath } from "node:url";

const app = express();

const publicPath = fileURLToPath(
  new URL("../public/", import.meta.url)
);

app.use(express.json());
app.use(express.static(publicPath));

export default app;