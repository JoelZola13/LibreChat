export type NanobotAgent = {
  name: string;
  displayName: string;
  team: string;
  role: string;
  description: string;
  model: string;
  status: string;
  chatUrl: string;
  handoffs: string[];
  toolCount: number;
};

export type AgentsResponse = {
  agents: NanobotAgent[];
  count: number;
  teams: string[];
  teamCount: number;
};
