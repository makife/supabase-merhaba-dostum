declare module '@heroiclabs/nakama-js' {
  export interface Session {
    user_id: string;
    username?: string;
    token?: string;
  }

  export interface MatchmakerTicket {
    ticket: string;
  }

  export interface Match {
    match_id: string;
    size: number;
    presence: any[];
  }

  export interface Tournament {
    tournament_id: string;
    title: string;
    description: string;
  }

  export interface Socket {
    connect(session: Session): Promise<void>;
    disconnect(): void;
    send(message: any): void;
    addMatchmaker(query: string, minCount: number, maxCount: number, stringProperties?: Record<string, string>): Promise<MatchmakerTicket>;
    removeMatchmaker(ticket: string): Promise<void>;
    createMatch(): Promise<Match>;
    joinMatch(matchId?: string, token?: string, metadata?: object): Promise<Match>;
    createTournament(params: any): Promise<Tournament>;
    joinTournament(tournamentId: string): Promise<void>;
    listTournaments(params: any): Promise<{ tournaments: Tournament[] }>;
    onmatchmakingmatched?: (matched: any) => void;
    onmatchmakermatched?: (matched: any) => void; // alias used in app
    onmatchmakerticket?: (ticket: any) => void;
  }

  export interface Client {
    authenticateDevice(deviceId: string): Promise<Session>;
    createSocket(useSSL?: boolean, verbose?: boolean): Socket;
  }

  export class Client {
    constructor(serverKey?: string, host?: string, port?: string, useSSL?: boolean);
    authenticateDevice(deviceId: string): Promise<Session>;
    createSocket(useSSL?: boolean, verbose?: boolean): Socket;
  }
}
