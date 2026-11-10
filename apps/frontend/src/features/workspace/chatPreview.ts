export type ChatAttachment = { id: string; name: string; detail: string };
export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  sentAt: string;
  own?: boolean;
  attachment?: ChatAttachment;
  likes?: number;
  liked?: boolean;
  mention?: boolean;
};
export type ChatThread = {
  id: string;
  title: string;
  member?: string;
  unread: number;
  messages: ChatMessage[];
};

function sampleTime(hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const initialChatThreads: ChatThread[] = [
  {
    id: 'team', title: 'DevUP Team', unread: 0,
    messages: [
      { id: 'm1', author: 'Sarah Kim', sentAt: sampleTime(10, 21), text: 'I’ve updated the backlog design. The mobile view now keeps task status visible without opening the card.', attachment: { id: 'design', name: 'board-flow.fig', detail: 'Figma design' }, likes: 3 },
      { id: 'm2', author: 'Alex Morgan', own: true, sentAt: sampleTime(10, 24), text: 'Much clearer. I’ll use this layout for the frontend changes today.' },
      { id: 'm3', author: 'Omar Idrissi', sentAt: sampleTime(10, 26), text: 'The task endpoints are ready for testing. I’ve included the response examples in the API contract.', attachment: { id: 'api', name: 'api-contract.pdf', detail: 'PDF document' }, likes: 2 },
      { id: 'm4', author: 'Maya Rodriguez', sentAt: sampleTime(10, 29), text: 'I’ll check the board on mobile after the integration. Can we compare notes at 3?' },
      { id: 'm5', author: 'Alex Morgan', own: true, sentAt: sampleTime(10, 31), text: 'Sounds good. I’ll add the mobile checks to DEV-27 before then.' },
    ],
  },
  { id: 'sarah', title: 'Sarah Kim', member: 'Sarah Kim', unread: 1, messages: [
    { id: 's1', author: 'Sarah Kim', sentAt: sampleTime(11, 15), text: 'Can you send me the latest login screen? I can review the error states this afternoon.', mention: true },
  ] },
  { id: 'omar', title: 'Omar Idrissi', member: 'Omar Idrissi', unread: 1, messages: [
    { id: 'o1', author: 'Omar Idrissi', sentAt: sampleTime(11, 4), text: 'The GitHub sync fix is ready to test. Try it on a repo with more than one branch.' },
  ] },
  { id: 'maya', title: 'Maya Rodriguez', member: 'Maya Rodriguez', unread: 0, messages: [
    { id: 'a1', author: 'Maya Rodriguez', sentAt: sampleTime(10, 18), text: 'Here’s the screenshot from the mobile login review.', attachment: { id: 'login', name: 'login-mobile.png', detail: 'Image' } },
  ] },
];
