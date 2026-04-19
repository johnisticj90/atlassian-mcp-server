import fetch from 'node-fetch';

export interface AtlassianConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  assignee?: string;
  priority?: string;
  issueType: string;
  created: string;
  updated: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  body?: string;
  version: number;
  created: string;
  updated: string;
  url: string;
}

export class AtlassianClient {
  private config: AtlassianConfig;
  private authHeader: string;

  constructor(config: AtlassianConfig) {
    this.config = config;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Atlassian API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  // Jira methods
  async getJiraIssue(issueKey: string): Promise<JiraIssue> {
    const data = await this.request<any>(`/rest/api/3/issue/${issueKey}`);
    return {
      id: data.id,
      key: data.key,
      summary: data.fields.summary,
      description: data.fields.description?.content?.[0]?.content?.[0]?.text,
      status: data.fields.status.name,
      assignee: data.fields.assignee?.displayName,
      priority: data.fields.priority?.name,
      issueType: data.fields.issuetype.name,
      created: data.fields.created,
      updated: data.fields.updated,
    };
  }

  async searchJiraIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    const data = await this.request<any>(`/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
    return data.issues.map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName,
      priority: issue.fields.priority?.name,
      issueType: issue.fields.issuetype.name,
      created: issue.fields.created,
      updated: issue.fields.updated,
    }));
  }

  // Confluence methods
  async getConfluencePage(pageId: string): Promise<ConfluencePage> {
    const data = await this.request<any>(`/wiki/rest/api/content/${pageId}?expand=body.storage,version,space`);
    return {
      id: data.id,
      title: data.title,
      spaceKey: data.space.key,
      body: data.body?.storage?.value,
      version: data.version.number,
      created: data.history?.createdDate,
      updated: data.version.when,
      url: `${this.config.baseUrl}/wiki${data._links.webui}`,
    };
  }

  async searchConfluencePages(query: string, spaceKey?: string): Promise<ConfluencePage[]> {
    const cql = spaceKey
      ? `text ~ "${query}" AND space.key = "${spaceKey}"`
      : `text ~ "${query}"`;
    const data = await this.request<any>(`/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&expand=version,space`);
    return data.results.map((page: any) => ({
      id: page.id,
      title: page.title,
      spaceKey: page.space?.key,
      version: page.version?.number,
      created: page.history?.createdDate,
      updated: page.version?.when,
      url: `${this.config.baseUrl}/wiki${page._links?.webui}`,
    }));
  }
}
