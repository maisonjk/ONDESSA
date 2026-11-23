/**
 * Thought-pattern database: every common lie maps deterministically to one Scripture,
 * a reframe, a personal truth statement, a reflection prompt, and a practical action.
 * This is what powers every standard Daily Renewal with zero AI cost.
 */

export type CategoryId =
  | 'fear' | 'anxiety' | 'identity' | 'insecurity' | 'rejection' | 'shame' | 'guilt'
  | 'comparison' | 'control' | 'unforgiveness' | 'loneliness' | 'purpose' | 'doubt' | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  /** One-line prompt shown under the label. */
  hint: string;
}

export const CATEGORIES: Category[] = [
  { id: 'fear', label: 'Fear', hint: 'Something feels threatening' },
  { id: 'anxiety', label: 'Anxiety', hint: 'My mind won’t settle' },
  { id: 'identity', label: 'Identity', hint: 'Who am I, really?' },
  { id: 'insecurity', label: 'Insecurity', hint: 'I don’t measure up' },
  { id: 'rejection', label: 'Rejection', hint: 'I feel unwanted' },
  { id: 'shame', label: 'Shame', hint: 'Something is wrong with me' },
  { id: 'guilt', label: 'Guilt', hint: 'I did something wrong' },
  { id: 'comparison', label: 'Comparison', hint: 'Everyone else is ahead' },
  { id: 'control', label: 'Control', hint: 'I have to hold it all together' },
  { id: 'unforgiveness', label: 'Unforgiveness', hint: 'I can’t let it go' },
  { id: 'loneliness', label: 'Loneliness', hint: 'I feel alone' },
  { id: 'purpose', label: 'Purpose', hint: 'Does my life matter?' },
  { id: 'doubt', label: 'Doubt', hint: 'Is God really there?' },
  { id: 'other', label: 'Something else', hint: 'Put it in my own words' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export interface Lie {
  id: string;
  text: string;
  categories: CategoryId[];
  /** Primary passage. */
  verseId: string;
  /** Supporting passages for library resurfacing and premium depth. */
  alsoVerseIds: string[];
  /** First-person truth statement the user practices believing. */
  truth: string;
  /** How the passage reframes the lie (app-written, labeled as reflection, not Scripture). */
  reframe: string;
  reflect: string;
  action: string;
  /** Lowercase keywords for deterministic matching of free-text thoughts. */
  keywords: string[];
}

const L = (l: Lie) => l;

export const LIES: Lie[] = [
  // FEAR
  L({ id: 'fear-something-bad', text: 'Something bad is going to happen.', categories: ['fear', 'anxiety'], verseId: 'isa-41-10', alsoVerseIds: ['john-16-33', 'ps-56-3'],
    truth: 'Whatever happens, God is with me and will hold me up.',
    reframe: 'Fear predicts a future without God in it. Isaiah 41:10 doesn’t promise nothing hard will happen. It promises you won’t face it alone or unsupported.',
    reflect: 'What specific outcome are you bracing for, and where is God in that picture?',
    action: 'When the fear returns today, say Isaiah 41:10 out loud once, then take the next small step anyway.',
    keywords: ['bad', 'happen', 'worst', 'scared', 'afraid', 'terrified', 'disaster', 'dread'] }),
  L({ id: 'fear-cant-handle', text: 'I can’t handle what’s coming.', categories: ['fear'], verseId: '2tim-1-7', alsoVerseIds: ['josh-1-9', 'deut-31-6'],
    truth: 'God has given me power, love, and self-control for what is in front of me.',
    reframe: 'You are measuring tomorrow’s challenge against today’s strength. God gives a spirit of power, love, and self-control, and strength tends to arrive as it’s needed.',
    reflect: 'What is one thing you’re avoiding because you assume you can’t handle it?',
    action: 'Do one small piece of the thing you’ve been avoiding, before noon if you can.',
    keywords: ['handle', 'cope', 'overwhelmed', 'too much', 'can\'t do', 'not strong'] }),
  L({ id: 'fear-unsafe', text: 'I’m not safe unless I’m certain.', categories: ['fear', 'control'], verseId: 'ps-56-3', alsoVerseIds: ['rom-8-38', 'prov-3-5'],
    truth: 'I can be afraid and still choose to trust God.',
    reframe: 'David didn’t wait to stop being afraid before trusting God. Certainty isn’t what makes you safe. God is.',
    reflect: 'Where are you demanding certainty before you’ll take a step of faith?',
    action: 'Make one decision today without over-researching it. Pray first, then decide.',
    keywords: ['certain', 'sure', 'unsafe', 'safe', 'what if', 'unknown'] }),

  // ANXIETY
  L({ id: 'anx-worry-protects', text: 'If I stop worrying, things will fall apart.', categories: ['anxiety', 'control'], verseId: 'phil-4-6', alsoVerseIds: ['1pet-5-7', 'phil-4-8'],
    truth: 'Prayer protects my heart better than worry ever could.',
    reframe: 'Worry feels responsible, but it guards nothing. Paul offers a trade: bring every request to God with thanksgiving, and his peace guards your heart and mind.',
    reflect: 'What are you worrying about that you haven’t actually prayed about yet?',
    action: 'Write down your top worry, pray about it specifically, and add one thing you’re thankful for.',
    keywords: ['worry', 'worried', 'anxious', 'anxiety', 'stressed', 'nervous', 'panic', 'overthinking', 'racing'] }),
  L({ id: 'anx-tomorrow', text: 'I have to figure out the whole future right now.', categories: ['anxiety', 'control'], verseId: 'matt-6-34', alsoVerseIds: ['prov-16-9', 'jer-29-11'],
    truth: 'I only need grace for today. God already holds tomorrow.',
    reframe: 'Anxiety pulls tomorrow’s problems into today. Jesus doesn’t ask you to stop planning; he asks you to stop carrying days you haven’t been given yet.',
    reflect: 'What is today actually asking of you, separate from everything in the future?',
    action: 'List only today’s three real tasks. Leave the rest on paper, not in your head.',
    keywords: ['future', 'tomorrow', 'figure out', 'plan', 'next year', 'everything'] }),
  L({ id: 'anx-alone-carry', text: 'I have to carry this by myself.', categories: ['anxiety', 'loneliness'], verseId: '1pet-5-7', alsoVerseIds: ['matt-11-28', 'ps-55-22'],
    truth: 'God cares for me, so I can hand my worries to him.',
    reframe: 'Peter connects casting your worries with humility. Admitting you weren’t built to carry everything isn’t weakness; it’s accurate.',
    reflect: 'Which burden have you been carrying silently?',
    action: 'Tell one trusted person what you’re carrying today, and let them pray for you.',
    keywords: ['carry', 'myself', 'burden', 'heavy', 'by myself', 'no help'] }),

  // IDENTITY
  L({ id: 'id-not-enough', text: 'I’m not good enough.', categories: ['identity', 'insecurity'], verseId: '2cor-12-9', alsoVerseIds: ['eph-2-8', 'eph-2-10'],
    truth: 'God’s grace is enough for me, even in my weakness.',
    reframe: 'Your worth is not determined by your performance. God didn’t tell Paul he was strong enough. He said his grace is sufficient, and his power shows up in weakness.',
    reflect: 'What would change today if you genuinely believed God’s grace is enough for you?',
    action: 'Instead of trying to prove your worth today, approach one situation with confidence in God’s grace.',
    keywords: ['not good enough', 'enough', 'inadequate', 'not enough', 'never enough', 'failure', 'not good'] }),
  L({ id: 'id-what-i-do', text: 'My worth depends on what I achieve.', categories: ['identity', 'purpose'], verseId: 'eph-2-10', alsoVerseIds: ['eph-2-8', 'gal-2-20'],
    truth: 'I am God’s workmanship. My work flows from my worth, not the other way around.',
    reframe: 'Paul says good works were prepared for you, but only after saying you are saved by grace, not by works. You work from acceptance, not for it.',
    reflect: 'Where are you working to earn something God has already given?',
    action: 'Do one task today purely as an offering, with no one watching and no credit expected.',
    keywords: ['achieve', 'worth', 'productive', 'success', 'accomplish', 'performance', 'prove'] }),
  L({ id: 'id-unlovable', text: 'I’m unlovable as I am.', categories: ['identity', 'shame', 'rejection'], verseId: 'rom-5-8', alsoVerseIds: ['1john-3-1', 'zeph-3-17'],
    truth: 'God loved me before I changed anything. I am his child.',
    reframe: 'God’s love was proven while we were still sinners. It was never a reward for becoming lovable; it’s what makes us loved.',
    reflect: 'What do you believe you have to fix before God could really love you?',
    action: 'Read Romans 5:8 slowly three times, inserting your name, and thank God for loving you first.',
    keywords: ['unlovable', 'love me', 'nobody loves', 'unloved', 'not loved', 'hate myself'] }),

  // INSECURITY
  L({ id: 'ins-everyone-judging', text: 'Everyone is judging me.', categories: ['insecurity', 'comparison'], verseId: 'gal-1-10', alsoVerseIds: ['col-3-23', '1sam-16-7'],
    truth: 'I live for an audience of One, and he is for me.',
    reframe: 'When others’ opinions become the measure, every room feels like a courtroom. Paul reframes the question: whose approval are you actually living for?',
    reflect: 'Whose opinion has the most power over your mood right now?',
    action: 'Make one choice today based on what pleases God, not what will look good.',
    keywords: ['judging', 'judge', 'what people think', 'embarrass', 'opinion', 'approval', 'awkward'] }),
  L({ id: 'ins-appearance', text: 'I’d be worth more if I looked different.', categories: ['insecurity', 'comparison'], verseId: '1sam-16-7', alsoVerseIds: ['ps-139-14'],
    truth: 'God looks at my heart, and he made me with care.',
    reframe: 'Samuel was impressed by appearance; God chose the overlooked shepherd. God doesn’t see as people see.',
    reflect: 'How much of your day is shaped by how you think you look?',
    action: 'Each time you catch yourself critiquing your appearance today, thank God for one thing he made well.',
    keywords: ['look', 'ugly', 'body', 'appearance', 'weight', 'attractive', 'face'] }),
  L({ id: 'ins-not-capable', text: 'I’m not capable of what God asks of me.', categories: ['insecurity', 'purpose'], verseId: 'phil-1-6', alsoVerseIds: ['2cor-12-9', 'josh-1-9'],
    truth: 'The God who started a good work in me will finish it.',
    reframe: 'Paul’s confidence wasn’t in the Philippians’ ability but in God’s faithfulness to complete what he started.',
    reflect: 'Where are you disqualifying yourself before God has?',
    action: 'Say yes to one small opportunity you would normally turn down out of insecurity.',
    keywords: ['capable', 'qualified', 'imposter', 'impostor', 'fraud', 'can\'t do it', 'unqualified'] }),

  // REJECTION
  L({ id: 'rej-unwanted', text: 'I’m unwanted.', categories: ['rejection', 'loneliness'], verseId: 'john-15-16', alsoVerseIds: ['1john-3-1', 'zeph-3-17'],
    truth: 'I am chosen by God. My belonging starts with his choice, not theirs.',
    reframe: 'Human rejection is real and it hurts. But it doesn’t get the final word on your value. Jesus said, “I chose you.”',
    reflect: 'Whose rejection are you letting define you?',
    action: 'Reach out to one person today who makes you feel seen, and thank God for them.',
    keywords: ['unwanted', 'rejected', 'left out', 'excluded', 'nobody wants', 'ignored', 'ghosted'] }),
  L({ id: 'rej-abandoned', text: 'The people I need will always leave.', categories: ['rejection', 'loneliness', 'fear'], verseId: 'ps-27-10', alsoVerseIds: ['heb-13-5', 'isa-49-15'],
    truth: 'Even when people leave, God will take me up. He will never forsake me.',
    reframe: 'David names the deepest possible rejection, from parents, and still says the Lord will take him up.',
    reflect: 'Where has past abandonment taught you to expect it again?',
    action: 'Instead of protecting yourself by pulling away today, take one small step toward trust.',
    keywords: ['leave', 'abandon', 'abandoned', 'left me', 'divorce', 'breakup', 'parents'] }),
  L({ id: 'rej-broken', text: 'My heart will never heal from this.', categories: ['rejection', 'shame'], verseId: 'ps-147-3', alsoVerseIds: ['ps-34-18'],
    truth: 'God is near to my broken heart and is binding up my wounds.',
    reframe: 'Healing is not pretending it didn’t hurt. The psalmist describes God as one who binds wounds, which means wounds are expected and tended to.',
    reflect: 'What would it look like to let God near the wound instead of guarding it?',
    action: 'Write a short honest prayer about the hurt. Don’t tidy it up.',
    keywords: ['heal', 'broken', 'heartbroken', 'hurt', 'wound', 'never recover', 'pain'] }),

  // SHAME
  L({ id: 'shame-past', text: 'My past defines me.', categories: ['shame', 'identity'], verseId: '2cor-5-17', alsoVerseIds: ['isa-43-18', 'rom-8-1'],
    truth: 'In Christ I am a new creation. The old has gone.',
    reframe: 'Your past is real, but it is not your identity. Paul says anyone in Christ is a new creation. You are not who you were.',
    reflect: 'Which part of your past still speaks louder than what God says about you?',
    action: 'When a memory accuses you today, answer it: “That happened. It is not who I am in Christ.”',
    keywords: ['past', 'history', 'what i did', 'used to', 'mistakes', 'define'] }),
  L({ id: 'shame-condemned', text: 'God is disappointed in me.', categories: ['shame', 'guilt'], verseId: 'rom-8-1', alsoVerseIds: ['zeph-3-17', 'heb-4-16'],
    truth: 'There is no condemnation for me in Christ Jesus.',
    reframe: 'Paul wrote this right after confessing his own ongoing struggle. The answer to failure isn’t self-condemnation; it’s life in Christ.',
    reflect: 'Do you picture God frowning at you right now? Where did that picture come from?',
    action: 'Pray honestly about where you fell short, then thank God out loud that there is no condemnation.',
    keywords: ['disappointed', 'god is mad', 'angry at me', 'condemned', 'punish', 'god hates'] }),
  L({ id: 'shame-hide', text: 'If people really knew me, they’d leave.', categories: ['shame', 'rejection'], verseId: 'heb-4-16', alsoVerseIds: ['rom-5-8', '1john-1-9'],
    truth: 'I can come to God boldly, fully known, and find mercy.',
    reframe: 'Shame tells you to hide. Hebrews tells you to draw near with boldness, because the One who knows you best offers mercy, not rejection.',
    reflect: 'What are you hiding that God already knows?',
    action: 'Share one honest thing with a safe person or with God today, instead of performing.',
    keywords: ['really knew', 'hide', 'hiding', 'secret', 'fake', 'exposed', 'mask'] }),

  // GUILT
  L({ id: 'guilt-unforgivable', text: 'What I did is unforgivable.', categories: ['guilt', 'shame'], verseId: '1john-1-9', alsoVerseIds: ['ps-103-12', 'lam-3-22'],
    truth: 'When I confess, God is faithful to forgive and cleanse me.',
    reframe: 'Forgiveness rests on God’s faithfulness, not on how bad you feel or how long you punish yourself.',
    reflect: 'Have you confessed this to God, and then kept punishing yourself anyway?',
    action: 'Confess it specifically to God today, then write “forgiven” and the date beside it.',
    keywords: ['unforgivable', 'forgive me', 'sin', 'what i did', 'regret', 'mistake', 'messed up'] }),
  L({ id: 'guilt-keep-paying', text: 'I have to keep paying for my mistakes.', categories: ['guilt'], verseId: 'ps-103-12', alsoVerseIds: ['eph-2-8', 'rom-8-1'],
    truth: 'God has removed my sin as far as the east is from the west.',
    reframe: 'Guilt keeps a ledger that God has already cleared. East and west never meet: forgiven sin isn’t coming back for repayment.',
    reflect: 'What are you still trying to pay off?',
    action: 'If an apology or repair is still needed, take that step today. Then stop paying for what’s been paid.',
    keywords: ['paying', 'pay for', 'deserve', 'punish myself', 'make up for', 'regret'] }),
  L({ id: 'guilt-ruined', text: 'I’ve ruined everything.', categories: ['guilt', 'doubt'], verseId: 'lam-3-22', alsoVerseIds: ['isa-43-18', 'rom-8-28'],
    truth: 'God’s mercies are new this morning. Nothing is beyond his faithfulness.',
    reframe: 'Lamentations was written in literal ruins, and still declares God’s mercies are new every morning.',
    reflect: 'What would a fresh start today look like, in one concrete step?',
    action: 'Take one restorative action today: an apology, a reset, or simply beginning again.',
    keywords: ['ruined', 'ruin', 'too late', 'blew it', 'destroyed', 'messed everything'] }),

  // COMPARISON
  L({ id: 'comp-behind', text: 'Everyone else is ahead of me.', categories: ['comparison', 'purpose'], verseId: 'gal-6-4', alsoVerseIds: ['heb-13-5', 'ps-139-14'],
    truth: 'I’m responsible for my own faithfulness, not someone else’s timeline.',
    reframe: 'Paul tells you to examine your own work, not someone else’s. Comparison measures you against a race you were never asked to run.',
    reflect: 'Whose life are you using as the ruler for yours?',
    action: 'Mute one account or skip one scroll session today that consistently feeds comparison.',
    keywords: ['ahead', 'behind', 'everyone else', 'compare', 'comparing', 'instagram', 'social media', 'jealous', 'envy'] }),
  L({ id: 'comp-less-than', text: 'I’m less than the people around me.', categories: ['comparison', 'insecurity'], verseId: 'ps-139-14', alsoVerseIds: ['1john-3-1', 'eph-2-10'],
    truth: 'I am fearfully and wonderfully made, on purpose.',
    reframe: 'David responds to being fully known with thanksgiving, not comparison. God’s works are wonderful, and that includes you.',
    reflect: 'What do you overlook in yourself because you’re focused on others?',
    action: 'Write down three ways God has uniquely made you, and thank him for each.',
    keywords: ['less than', 'better than me', 'smarter', 'prettier', 'more talented', 'inferior'] }),
  L({ id: 'comp-not-content', text: 'I’ll be happy when I have what they have.', categories: ['comparison'], verseId: 'heb-13-5', alsoVerseIds: ['phil-4-6'],
    truth: 'I can be content today because God will never leave me.',
    reframe: 'Hebrews ties contentment to God’s presence, not to possessions. What you have is enough when he is with you.',
    reflect: 'What are you waiting to have before you allow yourself to be content?',
    action: 'Before bed, name five things you already have that you’re grateful for.',
    keywords: ['happy when', 'have what', 'money', 'house', 'content', 'jealous'] }),

  // CONTROL
  L({ id: 'ctrl-everything', text: 'I have to control everything.', categories: ['control', 'anxiety'], verseId: 'prov-3-5', alsoVerseIds: ['ps-46-10', 'prov-16-9'],
    truth: 'I can trust God with what I can’t control.',
    reframe: 'Control promises safety but delivers exhaustion. Proverbs invites you to trust with all your heart instead of leaning only on your own understanding.',
    reflect: 'What are you gripping tightly right now that you could open your hands about?',
    action: 'Pick one thing outside your control and physically open your hands as you pray it over to God.',
    keywords: ['control', 'controlling', 'in control', 'perfect', 'perfectionist', 'hold it together', 'micromanage'] }),
  L({ id: 'ctrl-plans', text: 'If my plans fail, my life is off track.', categories: ['control', 'purpose'], verseId: 'prov-16-9', alsoVerseIds: ['rom-8-28', 'jer-29-11'],
    truth: 'I make plans, and God directs my steps.',
    reframe: 'Proverbs affirms making plans and reminds you God directs the steps. A detour isn’t the end of the road.',
    reflect: 'Where has God redirected you before in a way you’re now grateful for?',
    action: 'Hold today’s plan loosely. When something changes, pause and ask, “What might God be doing here?”',
    keywords: ['plans', 'plan', 'off track', 'didn\'t work out', 'failed', 'derailed'] }),
  L({ id: 'ctrl-still', text: 'If I stop striving, everything stops.', categories: ['control'], verseId: 'ps-46-10', alsoVerseIds: ['matt-11-28'],
    truth: 'I can be still, because God is God and I am not.',
    reframe: 'The psalm says “be still” while nations rage and mountains shake. Stillness is not passivity; it’s recognizing who actually holds the world.',
    reflect: 'When was the last time you were genuinely still before God?',
    action: 'Take five quiet minutes today with no phone. Just sit, breathe, and remember that God is God.',
    keywords: ['striving', 'stop', 'rest', 'busy', 'burnout', 'exhausted', 'tired'] }),

  // UNFORGIVENESS
  L({ id: 'unf-dont-deserve', text: 'They don’t deserve my forgiveness.', categories: ['unforgiveness'], verseId: 'eph-4-32', alsoVerseIds: ['col-3-13'],
    truth: 'I forgive because I have been forgiven.',
    reframe: 'Forgiveness was never about deserving. Paul ties it to how God forgave you in Christ: freely and at great cost.',
    reflect: 'What would it cost you to forgive, and what is unforgiveness costing you now?',
    action: 'Pray for the person by name today, even if it’s only one honest sentence.',
    keywords: ['deserve', 'forgive them', 'won\'t forgive', 'they hurt', 'betrayed', 'hurt me'] }),
  L({ id: 'unf-justice', text: 'If I forgive, they get away with it.', categories: ['unforgiveness'], verseId: 'rom-12-19', alsoVerseIds: ['ps-55-22'],
    truth: 'Justice belongs to God, so I can lay down the role of judge.',
    reframe: 'Forgiveness doesn’t say what happened was okay. It hands the case to the only righteous Judge.',
    reflect: 'Are you holding onto this to make sure they pay?',
    action: 'Write down what was done to you, then pray, “Lord, I hand this to you.”',
    keywords: ['get away', 'justice', 'revenge', 'unfair', 'pay', 'angry', 'bitter', 'resent'] }),
  L({ id: 'unf-cant-let-go', text: 'I can’t let this go.', categories: ['unforgiveness', 'control'], verseId: 'col-3-13', alsoVerseIds: ['eph-4-32', 'ps-55-22'],
    truth: 'Christ forgave me, and his grace can help me forgive too.',
    reframe: 'Colossians acknowledges the complaint is real. Forgiveness is usually a decision repeated over time, not one emotional moment.',
    reflect: 'What’s one small step toward letting go that feels possible?',
    action: 'Each time it replays today, say, “I choose to forgive again,” and redirect your thoughts.',
    keywords: ['let go', 'let it go', 'replay', 'can\'t forget', 'grudge', 'still hurts'] }),

  // LONELINESS
  L({ id: 'lone-alone', text: 'I’m alone.', categories: ['loneliness'], verseId: 'josh-1-9', alsoVerseIds: ['heb-13-5', 'ps-68-6'],
    truth: 'God is with me wherever I go.',
    reframe: 'You may feel alone, and that feeling is real. But God promised Joshua his presence “wherever you go.” Feeling alone is not the same as being alone.',
    reflect: 'Where in your day do you most feel alone?',
    action: 'Send one message today to someone you’ve been meaning to reconnect with.',
    keywords: ['alone', 'lonely', 'isolated', 'no friends', 'by myself', 'nobody'] }),
  L({ id: 'lone-forgotten', text: 'God has forgotten me.', categories: ['loneliness', 'doubt', 'rejection'], verseId: 'isa-49-15', alsoVerseIds: ['heb-13-5', 'ps-34-18'],
    truth: 'God has not forgotten me. He cannot.',
    reframe: 'Israel said the exact same words: “the Lord has forgotten me.” God answered that a mother may forget her child, but he will not forget you.',
    reflect: 'What makes you feel forgotten right now?',
    action: 'Write down one way God has been faithful to you in the past and keep it where you’ll see it.',
    keywords: ['forgotten', 'forgot me', 'god is silent', 'god doesn\'t care', 'where is god', 'unanswered'] }),
  L({ id: 'lone-no-belong', text: 'I don’t belong anywhere.', categories: ['loneliness', 'identity'], verseId: 'ps-68-6', alsoVerseIds: ['1john-3-1', 'john-15-16'],
    truth: 'I belong to God’s family, and he sets the lonely in families.',
    reframe: 'God’s heart moves toward the isolated. Belonging starts with being his child, and he builds community around that.',
    reflect: 'What small community could God be inviting you into?',
    action: 'Show up to one gathering this week: a church group, a Bible study, or a meal with a friend.',
    keywords: ['belong', 'fit in', 'outsider', 'no community', 'no church'] }),

  // PURPOSE
  L({ id: 'purp-no-matter', text: 'My life doesn’t matter.', categories: ['purpose', 'identity'], verseId: 'eph-2-10', alsoVerseIds: ['jer-29-11', 'col-3-23'],
    truth: 'I was created on purpose for good works God prepared for me.',
    reframe: 'Paul says God prepared good works in advance for you to walk in. Your ordinary life is not filler between “important” moments.',
    reflect: 'What ordinary moment today could carry eternal weight?',
    action: 'Do one quiet act of kindness today and treat it as the work God prepared for you.',
    keywords: ['matter', 'pointless', 'meaningless', 'purpose', 'why am i here', 'waste'] }),
  L({ id: 'purp-missed', text: 'I’ve missed God’s plan for my life.', categories: ['purpose', 'guilt'], verseId: 'rom-8-28', alsoVerseIds: ['isa-43-18', 'phil-1-6'],
    truth: 'God works in all things, including my detours, for his purpose.',
    reframe: 'Romans 8:28 doesn’t say all things are good. It says God works in all things for those who love him, including missed turns.',
    reflect: 'Where might God be working in a season you see as wasted?',
    action: 'Ask God today, “What do you want me to do with where I am right now?” and write down what comes to mind.',
    keywords: ['missed', 'plan', 'wrong path', 'too late', 'wasted', 'calling'] }),
  L({ id: 'purp-waiting', text: 'Nothing good is ahead for me.', categories: ['purpose', 'doubt'], verseId: 'jer-29-11', alsoVerseIds: ['rom-15-13', 'lam-3-22'],
    truth: 'God has thoughts of peace toward me and gives me hope.',
    reframe: 'Jeremiah 29:11 was written to exiles told to wait seventy years. It’s a promise of God’s faithfulness through a long wait, not a promise of instant results.',
    reflect: 'What would faithfulness look like in this waiting season?',
    action: 'Plant something small today, literally or figuratively, as an act of hope.',
    keywords: ['hopeless', 'nothing good', 'no future', 'never get better', 'stuck', 'waiting'] }),

  // DOUBT
  L({ id: 'doubt-not-real', text: 'My faith is too weak for God to work with.', categories: ['doubt'], verseId: 'mark-9-24', alsoVerseIds: ['jas-1-5', 'rom-15-13'],
    truth: 'God welcomes my honest, imperfect faith.',
    reframe: 'The father said “I believe. Help my unbelief!” and Jesus healed his son. Honest doubt brought to Jesus is a form of faith.',
    reflect: 'What doubt have you been afraid to say out loud to God?',
    action: 'Pray this exact prayer today: “I believe. Help my unbelief.”',
    keywords: ['doubt', 'faith', 'believe', 'weak faith', 'not sure god', 'questions'] }),
  L({ id: 'doubt-no-answer', text: 'God won’t guide me.', categories: ['doubt', 'purpose'], verseId: 'jas-1-5', alsoVerseIds: ['prov-3-5'],
    truth: 'God gives wisdom generously when I ask, without scolding me.',
    reframe: 'James says God gives wisdom liberally “without reproach.” You don’t have to earn guidance or apologize for needing it.',
    reflect: 'What decision do you need wisdom for right now?',
    action: 'Ask God for wisdom about one specific decision, then talk it through with a wise friend.',
    keywords: ['guide', 'guidance', 'decision', 'wisdom', 'confused', 'don\'t know what to do', 'lost'] }),
  L({ id: 'doubt-never-change', text: 'I will never change.', categories: ['doubt', 'identity', 'shame'], verseId: 'phil-1-6', alsoVerseIds: ['2cor-5-17', 'rom-12-2'],
    truth: 'God is still working in me, and he finishes what he starts.',
    reframe: 'Change rarely feels like change while it’s happening. Paul’s confidence rested on God’s faithfulness, not on visible progress.',
    reflect: 'Where can you see even a little growth compared to a year ago?',
    action: 'Write down one way you’ve grown, however small, and thank God for it.',
    keywords: ['never change', 'same', 'always like this', 'stuck', 'can\'t change', 'again'] }),
];

export const LIE_BY_ID: Record<string, Lie> = Object.fromEntries(LIES.map((l) => [l.id, l]));

export function liesForCategory(cat: CategoryId): Lie[] {
  if (cat === 'other') return [];
  return LIES.filter((l) => l.categories[0] === cat).concat(
    LIES.filter((l) => l.categories[0] !== cat && l.categories.includes(cat)),
  );
}
