/**
 * Calculates estimated cost in USD based on model pricing per 1M tokens.
 */
export function calculateLlmCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const norm = model.toLowerCase();

  let inputPricePerMillion = 0.10;
  let outputPricePerMillion = 0.40;

  if (norm.includes('flash-lite') || norm.includes('lite')) {
    inputPricePerMillion = 0.0375;
    outputPricePerMillion = 0.15;
  } else if (norm.includes('2.5-flash') || norm.includes('1.5-flash')) {
    inputPricePerMillion = 0.075;
    outputPricePerMillion = 0.30;
  } else if (norm.includes('pro')) {
    inputPricePerMillion = 1.25;
    outputPricePerMillion = 5.00;
  } else if (norm.includes('deepseek')) {
    inputPricePerMillion = 0.14;
    outputPricePerMillion = 0.28;
  }

  const cost =
    (promptTokens / 1_000_000) * inputPricePerMillion +
    (completionTokens / 1_000_000) * outputPricePerMillion;

  return Math.round(cost * 1_000_000) / 1_000_000;
}
