/**
 * Rozka cost guard — auto-pause paid Lambdas when estimated AWS bill hits cap.
 * Checks billing every 6 hours; sets reserved concurrency to 0 to stop new cost.
 */
const {
  LambdaClient,
  PutFunctionConcurrencyCommand,
  DeleteFunctionConcurrencyCommand,
  GetFunctionConcurrencyCommand,
} = require('@aws-sdk/client-lambda');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.PAUSE_REGION || process.env.AWS_REGION || 'ap-south-1';
const BILLING_REGION = process.env.BILLING_REGION || 'us-east-1';
const FUNCTIONS = (process.env.PAUSE_FUNCTIONS || 'rozka-voice-parse,rozka-push-relay')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SNS_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const MONTHLY_CAP_USD = parseFloat(process.env.MONTHLY_CAP_USD || '10');

function snsRegionFromArn(arn) {
  if (!arn) return BILLING_REGION;
  const parts = arn.split(':');
  return parts.length >= 4 ? parts[3] : BILLING_REGION;
}

async function notify(subject, message) {
  if (!SNS_TOPIC_ARN) return;
  const sns = new SNSClient({ region: snsRegionFromArn(SNS_TOPIC_ARN) });
  await sns.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject.slice(0, 100),
      Message: message,
    }),
  );
}

async function isPaused(name) {
  const client = new LambdaClient({ region: REGION });
  try {
    const res = await client.send(new GetFunctionConcurrencyCommand({ FunctionName: name }));
    return res.ReservedConcurrentExecutions === 0;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function setPause(pause) {
  const client = new LambdaClient({ region: REGION });
  const results = [];
  for (const name of FUNCTIONS) {
    try {
      if (pause) {
        await client.send(
          new PutFunctionConcurrencyCommand({
            FunctionName: name,
            ReservedConcurrentExecutions: 0,
          }),
        );
        results.push({ name, state: 'paused' });
      } else {
        await client.send(new DeleteFunctionConcurrencyCommand({ FunctionName: name }));
        results.push({ name, state: 'resumed' });
      }
    } catch (err) {
      results.push({ name, error: err.message || String(err) });
    }
  }
  return results;
}

async function getEstimatedChargesUsd() {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const cw = new CloudWatchClient({ region: BILLING_REGION });
  const res = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: 'AWS/Billing',
      MetricName: 'EstimatedCharges',
      Dimensions: [{ Name: 'Currency', Value: 'USD' }],
      StartTime: start,
      EndTime: end,
      Period: 21600,
      Statistics: ['Maximum'],
    }),
  );
  const points = res.Datapoints || [];
  if (!points.length) return null;
  return Math.max(...points.map((p) => parseFloat(p.Maximum)));
}

async function checkAndPauseIfNeeded() {
  const charges = await getEstimatedChargesUsd();
  if (charges === null) {
    return {
      ok: true,
      action: 'skip',
      reason:
        'No billing data yet. In AWS Console enable Billing -> Preferences -> Receive Billing Alerts.',
    };
  }

  if (charges < MONTHLY_CAP_USD) {
    return { ok: true, action: 'ok', charges, cap: MONTHLY_CAP_USD, paused: false };
  }

  const alreadyPaused = (await Promise.all(FUNCTIONS.map(isPaused))).every(Boolean);
  if (alreadyPaused) {
    return { ok: true, action: 'already_paused', charges, cap: MONTHLY_CAP_USD };
  }

  const results = await setPause(true);
  await notify(
    `Rozka AWS paused — bill $${charges.toFixed(2)}`,
    `Rozka AI AWS services were auto-paused.\n\nEstimated charges: $${charges.toFixed(2)} USD\nCap: $${MONTHLY_CAP_USD} USD\n\nFunctions: ${FUNCTIONS.join(', ')}\n\nResults:\n${JSON.stringify(results, null, 2)}\n\nResume: .\\deploy\\aws-cost-guard-setup.ps1 -Resume`,
  );
  return { ok: true, action: 'pause', charges, cap: MONTHLY_CAP_USD, results };
}

exports.handler = async (event) => {
  const action = event.action;

  if (action === 'resume') {
    const results = await setPause(false);
    await notify('Rozka AWS resumed', `Services resumed.\n${JSON.stringify(results, null, 2)}`);
    return { ok: true, action: 'resume', results };
  }

  if (action === 'pause') {
    const results = await setPause(true);
    return { ok: true, action: 'pause', results, reason: event.reason || 'Manual invoke' };
  }

  if (action === 'check' || event.source === 'aws.events') {
    return checkAndPauseIfNeeded();
  }

  if (event.Records?.[0]?.Sns?.Message) {
    try {
      const msg = JSON.parse(event.Records[0].Sns.Message);
      if (msg.AlarmName && msg.NewStateValue === 'ALARM') {
        return checkAndPauseIfNeeded();
      }
    } catch {
      /* ignore */
    }
  }

  return checkAndPauseIfNeeded();
};
