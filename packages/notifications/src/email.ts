export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(message: EmailMessage) {
  // Dev stub: log email payload
  console.info("email:send", message);
  return { delivered: true, messageId: `demo-${Date.now()}` };
}
