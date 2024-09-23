// retry config
export const RETRY_COUNT = "x-max-retries";
export const MAX_RETRIES = process.env.MAX_FAILED_MESSAGE_RETRIES
  ? +process.env.MAX_FAILED_MESSAGE_RETRIES
  : 1;

// exponential backoff config
export const EXPONENTIAL_BACKOFF = "x-exponential-backoff-in-seconds";
export const EXPONENTIAL_BACKOFF_IN_SECONDS = process.env
  .EXPONENTIAL_BACKOFF_IN_SECONDS
  ? +process.env.EXPONENTIAL_BACKOFF_IN_SECONDS
  : 2;

// delay
export const DELAY = "x-delay";

export type PublishOptions = {
  headers: PublishHeader;
};

type PublishHeader = {
  [RETRY_COUNT]?: number;
  [EXPONENTIAL_BACKOFF]?: number;
  [DELAY]?: number;
};
