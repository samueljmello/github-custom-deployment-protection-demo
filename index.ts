import express from 'express';
import { Request } from 'express';
import * as crypto from "crypto";
import bodyParser from 'body-parser';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from "@octokit/auth-app";

// set constants
const WEBHOOK_SECRET: string = process.env.WEBHOOK_SECRET!;
const GH_APP_ID: string = process.env.GH_APP_ID!;
const GH_APP_INSTALL_ID: string = process.env.GH_APP_INSTALL_ID!;
const GH_PRIVATE_KEY: string = process.env.GH_PRIVATE_KEY!;

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: GH_APP_ID,
    privateKey: GH_PRIVATE_KEY,
    installationId: GH_APP_INSTALL_ID,
  },
});

// set up app
const app = express();

// use body parser
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// listen for POST requests on /
app.post('/', async (req, res) => {

  // validate secret
  if (!verify_signature(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  // send approval
  await octokit.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule", {
    owner: "mello-testing",
    repo: "testing-deployment-protection",
    run_id: 6097097112,
    environment_name: "prod",
    state: "approved",
    comment: "LGTM"
  });

  res.send('OK');
})

app.listen(80, () => {
    console.log('The application is listening on port 80!');
})

// verification method
const verify_signature = (req: Request) => {
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");
  const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
  const untrusted = Buffer.from(`${req.headers["x-hub-signature-256"]}`, 'ascii');
  return crypto.timingSafeEqual(trusted, untrusted);
};