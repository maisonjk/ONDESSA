/** Guided multi-day journeys (premium). Each day is a pre-selected lie, so it runs the same zero-cost renewal flow. */

export interface Journey {
  id: string;
  title: string;
  subtitle: string;
  days: { title: string; lieId: string }[];
}

export const JOURNEYS: Journey[] = [
  {
    id: 'identity-7', title: 'Rooted: 7 days on identity', subtitle: 'Stop performing for worth you already have.',
    days: [
      { title: 'Grace is enough', lieId: 'id-not-enough' },
      { title: 'Loved first', lieId: 'id-unlovable' },
      { title: 'Made on purpose', lieId: 'comp-less-than' },
      { title: 'Work from worth', lieId: 'id-what-i-do' },
      { title: 'A new creation', lieId: 'shame-past' },
      { title: 'Chosen', lieId: 'rej-unwanted' },
      { title: 'Still being made', lieId: 'doubt-never-change' },
    ],
  },
  {
    id: 'anxiety-7', title: 'Steady: 7 days for an anxious mind', subtitle: 'Trade worry for prayer, one day at a time.',
    days: [
      { title: 'Prayer over worry', lieId: 'anx-worry-protects' },
      { title: 'Just today', lieId: 'anx-tomorrow' },
      { title: 'You don’t carry it alone', lieId: 'anx-alone-carry' },
      { title: 'Open hands', lieId: 'ctrl-everything' },
      { title: 'Afraid and trusting', lieId: 'fear-unsafe' },
      { title: 'Be still', lieId: 'ctrl-still' },
      { title: 'With you in it', lieId: 'fear-something-bad' },
    ],
  },
  {
    id: 'freedom-7', title: 'Unburdened: 7 days free from shame', subtitle: 'Your past is real. It isn’t your name.',
    days: [
      { title: 'No condemnation', lieId: 'shame-condemned' },
      { title: 'Confess and be cleansed', lieId: 'guilt-unforgivable' },
      { title: 'Paid in full', lieId: 'guilt-keep-paying' },
      { title: 'Come out of hiding', lieId: 'shame-hide' },
      { title: 'New mercies', lieId: 'guilt-ruined' },
      { title: 'Forgiving others', lieId: 'unf-dont-deserve' },
      { title: 'A new thing', lieId: 'shame-past' },
    ],
  },
];

export const JOURNEY_BY_ID = Object.fromEntries(JOURNEYS.map((j) => [j.id, j]));
