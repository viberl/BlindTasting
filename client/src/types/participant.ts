export interface Participant {
  id: string;
  user: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  role: 'host' | 'guest' | 'judge';
  joinedAt: Date | string;
  status?: 'active' | 'pending';
  // Weitere Felder nach Bedarf
}

export interface ParticipantWithUser extends Participant {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
}
