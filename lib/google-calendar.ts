import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google-calendar`
);

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setCredentials(tokens: { access_token?: string | null; refresh_token?: string | null }) {
  oauth2Client.setCredentials(tokens);
}

export async function refreshAccessToken(refreshToken: string) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getCalendarList(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId,
    timeMin: options?.timeMin || new Date().toISOString(),
    timeMax: options?.timeMax,
    maxResults: options?.maxResults || 100,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

export { oauth2Client };
