export type Channel = 'whatsapp' | 'web';
/** bot = still with the assistant · waiting = handed off, nobody has claimed it · assigned · closed */
export type ConvStatus = 'bot' | 'waiting' | 'assigned' | 'closed';
/** system = shown to the family · note = staff-only (transfers, close outcome, internal remarks) */
export type Author = 'contact' | 'bot' | 'staff' | 'system' | 'note';

export interface Conversation {
  id: string;
  channel: Channel;
  contactPhone: string | null;
  contactName: string | null;
  leadId: string | null;
  status: ConvStatus;
  assigneeId: string | null;
  handoffReason: string | null;
  handoffAt: string | null;
  lastMessageAt: string;
  /** last message from the family: opens WhatsApp's 24-hour customer-service window */
  lastInboundAt: string | null;
  /** messages from the family not yet seen by staff */
  unread: number;
  /** sha256 of the web visitor's token (web channel only) */
  visitorTokenHash: string | null;
  createdAt: string;
  closedAt: string | null;
  closeNote: string | null;
}

export interface ConvMessage {
  id: string;
  conversationId: string;
  author: Author;
  staffId: string | null;
  text: string;
  /** link to the WhatsApp outbox row (delivery status) */
  waMessageId: string | null;
  createdAt: string;
}

export interface ConversationStore {
  create(c: Omit<Conversation, 'id' | 'createdAt' | 'lastMessageAt' | 'unread' | 'closedAt' | 'closeNote' | 'lastInboundAt'>): Promise<Conversation>;
  get(id: string): Promise<Conversation | null>;
  /** the open (not closed) conversation for a WhatsApp number */
  findOpenByPhone(phone: string): Promise<Conversation | null>;
  update(id: string, patch: Partial<Pick<Conversation, 'status' | 'assigneeId' | 'leadId' | 'contactName' | 'handoffReason' | 'handoffAt' | 'closedAt' | 'closeNote' | 'unread'>>): Promise<void>;
  /** Appends and bumps lastMessageAt (and lastInboundAt + unread for messages from the family). */
  addMessage(m: Omit<ConvMessage, 'id' | 'createdAt'> & { createdAt?: string }): Promise<ConvMessage>;
  messages(conversationId: string, after?: string): Promise<ConvMessage[]>;
  list(filter: { statuses?: ConvStatus[]; assigneeId?: string; leadIds?: string[]; limit?: number }): Promise<Conversation[]>;
}
