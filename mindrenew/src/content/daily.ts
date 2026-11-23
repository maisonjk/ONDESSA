import type { CategoryId } from './lies';

export interface DailyTruth {
  id: string;
  verseId: string;
  title: string;
  explanation: string;
  question: string;
  application: string;
}

const D = (d: DailyTruth) => d;

/** Rotates by day. Prewritten so the daily Scripture costs nothing to serve. */
export const DAILY_TRUTHS: DailyTruth[] = [
  D({ id: 'd-renew', verseId: 'rom-12-2', title: 'Transformation starts in the mind',
    explanation: 'God changes lives from the inside out. What you repeatedly believe shapes how you respond, and renewal is the daily practice of thinking in line with what God says.',
    question: 'Which thought has been shaping your day more than God’s Word?',
    application: 'Notice one recurring thought today and ask, “Is this true according to God?”' }),
  D({ id: 'd-captive', verseId: '2cor-10-5', title: 'You don’t have to believe every thought',
    explanation: 'Thoughts arrive uninvited, but you get to examine them. Paul describes taking thoughts captive: holding them up to the truth of Christ before letting them steer you.',
    question: 'What thought would you like to take captive today?',
    application: 'When a harsh inner voice speaks today, pause and answer it with one true sentence.' }),
  D({ id: 'd-free', verseId: 'john-8-32', title: 'Truth is what sets you free',
    explanation: 'Freedom doesn’t come from positive thinking. It comes from knowing what is actually true about God and about you, and living from it.',
    question: 'What truth do you know in your head but don’t yet live from?',
    application: 'Write that truth on a sticky note or phone lock screen for today.' }),
  D({ id: 'd-grace', verseId: '2cor-12-9', title: 'Grace meets you in weakness',
    explanation: 'God didn’t remove Paul’s weakness. He met him in it. Your weak places may be exactly where his strength is most visible.',
    question: 'Where are you hiding weakness instead of inviting grace into it?',
    application: 'Admit one limitation to God today, then ask for his strength there.' }),
  D({ id: 'd-with', verseId: 'isa-41-10', title: 'Not alone in it',
    explanation: 'God’s answer to fear isn’t “nothing bad will happen.” It’s “I am with you.” Courage grows from presence, not from guarantees.',
    question: 'What are you facing today that you’ve been facing alone?',
    application: 'Before a hard moment today, pause and pray, “You are with me.”' }),
  D({ id: 'd-anxious', verseId: 'phil-4-6', title: 'Trade worry for prayer',
    explanation: 'Paul doesn’t shame anxiety. He redirects it: turn each worry into a request, add thanksgiving, and let God’s peace stand guard over your heart.',
    question: 'What is one worry you can turn into a specific prayer?',
    application: 'Pray about your top worry, then name three things you’re thankful for.' }),
  D({ id: 'd-new', verseId: '2cor-5-17', title: 'Your past isn’t your identity',
    explanation: 'In Christ you are a new creation. Your history is real, but it no longer gets to name you.',
    question: 'What old label do you still answer to?',
    application: 'Replace that label with one thing God says is true of you in Christ.' }),
  D({ id: 'd-nocondemn', verseId: 'rom-8-1', title: 'No condemnation',
    explanation: 'Conviction leads you toward God; condemnation drives you away. In Christ, condemnation is off the table.',
    question: 'Are you hearing conviction or condemnation right now?',
    application: 'If you need to confess something, do it, then thank God there is no condemnation.' }),
  D({ id: 'd-workmanship', verseId: 'eph-2-10', title: 'Made on purpose',
    explanation: 'You are God’s workmanship. Purpose isn’t something you have to manufacture; good works were prepared for you to walk in.',
    question: 'What “ordinary” part of your day could be part of God’s purpose?',
    application: 'Do one ordinary task today as if it were prepared for you by God.' }),
  D({ id: 'd-trust', verseId: 'prov-3-5', title: 'Trust over control',
    explanation: 'Your understanding is limited, and that’s okay. Trust is acknowledging God in every area instead of leaning only on what you can see.',
    question: 'Where are you leaning on your own understanding?',
    application: 'Name one area you’ll intentionally acknowledge God in today.' }),
  D({ id: 'd-rest', verseId: 'matt-11-28', title: 'Rest is an invitation',
    explanation: 'Jesus doesn’t say “try harder.” He says “come to me.” Rest begins with coming, not with fixing.',
    question: 'What heavy thing would you hand to Jesus if you believed he would take it?',
    application: 'Take ten quiet minutes today with no phone. Just come to him.' }),
  D({ id: 'd-forgiven', verseId: 'eph-4-32', title: 'Forgiven people forgive',
    explanation: 'We forgive from the overflow of having been forgiven. It’s not pretending it didn’t hurt; it’s refusing to let it own you.',
    question: 'Who comes to mind when you read this verse?',
    application: 'Pray one honest sentence of blessing over that person today.' }),
  D({ id: 'd-mercies', verseId: 'lam-3-22', title: 'New every morning',
    explanation: 'Written in the ruins of Jerusalem, this is hope chosen in the dark. Yesterday doesn’t use up today’s mercy.',
    question: 'What from yesterday do you need to leave in yesterday?',
    application: 'Start one thing fresh today that you thought you’d already ruined.' }),
  D({ id: 'd-separate', verseId: 'rom-8-38', title: 'Nothing can separate you',
    explanation: 'Paul lists everything that could possibly threaten God’s love: death, life, powers, the future. None of it can separate you from God’s love in Christ.',
    question: 'What have you feared could separate you from God’s love?',
    application: 'Read Romans 8:38-39 aloud, and add your current fear to the list.' }),
  D({ id: 'd-think', verseId: 'phil-4-8', title: 'Choose what you dwell on',
    explanation: 'You can’t control every thought that arrives, but you can choose what you keep thinking about. Paul gives a filter: true, honorable, just, pure, lovely.',
    question: 'What has been occupying your mind that fails this filter?',
    application: 'Swap one scroll session today for something true and lovely.' }),
  D({ id: 'd-child', verseId: '1john-3-1', title: 'Called a child of God',
    explanation: 'Your primary identity isn’t your job, your relationships, or your mistakes. It is “child of God,” given in love.',
    question: 'How would you walk into today if you fully believed you were God’s child?',
    application: 'Introduce yourself silently to God today: “I am your child.”' }),
  D({ id: 'd-still', verseId: 'ps-46-10', title: 'Be still',
    explanation: 'Stillness is not inactivity; it’s remembering who is God. The world can shake while your soul stays anchored.',
    question: 'What would it take for you to be still for five minutes today?',
    application: 'Set a 5-minute timer, put your phone away, and simply be with God.' }),
  D({ id: 'd-peace', verseId: 'isa-26-3', title: 'A steadfast mind',
    explanation: 'Peace is tied to focus. A mind fixed on God is held steady even when circumstances aren’t.',
    question: 'Where has your mind been fixed this week?',
    application: 'Each time you check your phone today, take one breath and think of one true thing about God.' }),
  D({ id: 'd-unbelief', verseId: 'mark-9-24', title: 'Honest faith is real faith',
    explanation: 'Jesus didn’t demand perfect faith from the father. He responded to honest faith mixed with doubt.',
    question: 'What doubt can you bring honestly to God today?',
    application: 'Pray: “I believe. Help my unbelief.”' }),
  D({ id: 'd-chosen', verseId: 'john-15-16', title: 'Chosen first',
    explanation: 'Your belonging with God didn’t start with your choice. It started with his.',
    question: 'Where do you feel like you have to earn your place?',
    application: 'Walk into one room today reminding yourself: “I am chosen.”' }),
  D({ id: 'd-overcome', verseId: 'john-16-33', title: 'Peace in a troubled world',
    explanation: 'Jesus was honest: you will have trouble. But he has overcome the world, so peace is available in him even now.',
    question: 'What trouble are you facing that needs Jesus’ peace?',
    application: 'Name the trouble, then pray, “You have overcome this too.”' }),
];

/** Days since a fixed epoch in the user's local time zone. */
export function localDayNumber(d = new Date()): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utc / 86_400_000);
}

export function dailyTruthFor(d = new Date()): DailyTruth {
  return DAILY_TRUTHS[localDayNumber(d) % DAILY_TRUTHS.length];
}

export interface WeeklyTheme {
  title: string;
  subtitle: string;
  focus: CategoryId[];
}

export const WEEKLY_THEMES: WeeklyTheme[] = [
  { title: 'Who God says you are', subtitle: 'Identity rooted in grace, not performance', focus: ['identity', 'insecurity'] },
  { title: 'Peace for an anxious mind', subtitle: 'Trading worry for prayer and trust', focus: ['anxiety', 'control'] },
  { title: 'Free from the past', subtitle: 'Shame and guilt don’t get the final word', focus: ['shame', 'guilt'] },
  { title: 'Fully known, fully loved', subtitle: 'Belonging when you feel rejected or alone', focus: ['rejection', 'loneliness'] },
  { title: 'Courage over fear', subtitle: 'God’s presence is your security', focus: ['fear', 'doubt'] },
  { title: 'Running your own race', subtitle: 'Contentment over comparison', focus: ['comparison', 'purpose'] },
];

export function weeklyThemeFor(d = new Date()): WeeklyTheme {
  return WEEKLY_THEMES[Math.floor(localDayNumber(d) / 7) % WEEKLY_THEMES.length];
}
