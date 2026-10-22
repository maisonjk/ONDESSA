/**
 * Static, versioned educational content. Ships with the app; no CMS, no network.
 *
 * General educational information written from the cited public sources. Not medical
 * advice; every article lists its sources and points to a doctor or midwife for personal
 * questions (docs/08-editorial-policy.md).
 */

export type Category =
  | 'cycles' | 'ovulation' | 'conceiving' | 'pregnancy' | 'perimenopause' | 'symptoms' | 'care';

export const CATEGORIES: { id: Category; title: string; blurb: string }[] = [
  { id: 'cycles', title: 'Menstrual cycles', blurb: 'What a cycle is and what “typical” really covers.' },
  { id: 'ovulation', title: 'Ovulation & fertility', blurb: 'How ovulation works and why estimates are uncertain.' },
  { id: 'conceiving', title: 'Trying to conceive', blurb: 'Timing, signs, and when to ask for help.' },
  { id: 'pregnancy', title: 'Pregnancy', blurb: 'Dating, early weeks, and common experiences.' },
  { id: 'perimenopause', title: 'Perimenopause', blurb: 'The years of change before menopause.' },
  { id: 'symptoms', title: 'Common symptoms', blurb: 'Cramps, PMS, headaches and more.' },
  { id: 'care', title: 'When to seek care', blurb: 'Signs that deserve a professional opinion.' },
];

export interface Source {
  label: string;
  url: string;
}

export interface Article {
  slug: string;
  category: Category;
  title: string;
  summary: string;
  minutes: number;
  sections: { heading?: string; body: string[] }[];
  sources: Source[];
  drafted: string;
}


const S = {
  acogCycle: { label: 'ACOG: Your Changing Body / menstruation FAQs', url: 'https://www.acog.org/womens-health/faqs' },
  figo: { label: 'Munro MG et al. FIGO systems for abnormal uterine bleeding (2018), Int J Gynaecol Obstet', url: 'https://doi.org/10.1002/ijgo.12666' },
  nhsPeriods: { label: 'NHS: Periods', url: 'https://www.nhs.uk/conditions/periods/' },
  nhsPms: { label: 'NHS: PMS (premenstrual syndrome)', url: 'https://www.nhs.uk/conditions/pre-menstrual-syndrome/' },
  wilcox: { label: 'Wilcox AJ et al. Timing of sexual intercourse in relation to ovulation (1995), NEJM', url: 'https://doi.org/10.1056/NEJM199512073332301' },
  nichdFert: { label: 'NICHD: Infertility and fertility', url: 'https://www.nichd.nih.gov/health/topics/infertility' },
  nhsTtc: { label: 'NHS: Trying to get pregnant', url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/' },
  asrm: { label: 'ASRM: Optimizing natural fertility, committee opinion (2022)', url: 'https://www.asrm.org/practice-guidance/' },
  acogDue: { label: 'ACOG Committee Opinion 700: Methods for Estimating the Due Date', url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date' },
  nhsPreg: { label: 'NHS: Your pregnancy and baby guide', url: 'https://www.nhs.uk/pregnancy/' },
  nhsUrgent: { label: 'NHS: Pregnancy – when to get urgent help', url: 'https://www.nhs.uk/pregnancy/related-conditions/' },
  nhsPeri: { label: 'NHS: Perimenopause', url: 'https://www.nhs.uk/conditions/menopause/' },
  nams: { label: 'The Menopause Society: Menopause FAQs', url: 'https://menopause.org/patient-education' },
  nhsHeavy: { label: 'NHS: Heavy periods', url: 'https://www.nhs.uk/conditions/heavy-periods/' },
  nhsPainful: { label: 'NHS: Period pain', url: 'https://www.nhs.uk/conditions/period-pain/' },
};

export const ARTICLES: Article[] = [
  {
    slug: 'what-is-a-typical-cycle',
    category: 'cycles',
    title: 'What counts as a “typical” cycle?',
    summary: 'A cycle runs from the first day of one period to the day before the next. Typical is a range, not a number.',
    minutes: 3,
    drafted: '2026-10-22',
    sources: [S.figo, S.nhsPeriods, S.acogCycle],
    sections: [
      { body: [
        'Your cycle starts on the first day of real bleeding (not spotting) and ends the day before your next period begins.',
        'For adults, international guidance (FIGO, 2018) describes a typical cycle as roughly 24 to 38 days, with periods lasting up to 8 days. The famous “28 days” is an average, not a target.',
      ] },
      { heading: 'Variation is normal', body: [
        'Most people see cycles change by a few days from month to month. Variation of up to about 7 to 9 days between your shortest and longest cycle is still generally considered regular.',
        'Cycles are often less predictable in the first years after periods begin, after pregnancy, while breastfeeding, after stopping hormonal contraception, and in the years before menopause.',
      ] },
      { heading: 'How Ondessa uses this', body: [
        'Ondessa predicts from your own history, using the median of your recent cycles. It shows a wider window when your cycles vary more, and tells you how confident it is.',
      ] },
    ],
  },
  {
    slug: 'how-predictions-work',
    category: 'cycles',
    title: 'How Ondessa’s predictions work',
    summary: 'Plain rules, run on your device. No AI guessing, nothing sent anywhere.',
    minutes: 4,
    drafted: '2026-10-22',
    sources: [S.figo, S.wilcox],
    sections: [
      { body: [
        'Every prediction comes from a small set of published rules applied to what you logged. The same inputs always give the same answer, and the calculation happens on your device.',
      ] },
      { heading: 'Next period', body: [
        'With fewer than 3 complete cycles, Ondessa blends your history with the cycle length you entered. From 3 cycles, it uses the median of your last 6. Cycles shorter than 15 or longer than 90 days are shown but left out, because they usually mean a missed log.',
      ] },
      { heading: 'Confidence levels', body: [
        'Limited data: fewer than 3 complete cycles. Developing pattern: 3 or more cycles, but not yet 6, or cycles that vary by more than 7 days. Established personal pattern: 6 or more recent cycles varying by 7 days or less.',
      ] },
      { heading: 'Fertile window', body: [
        'Ovulation is estimated 14 days before your next expected period. The fertile window is the 5 days before that estimate plus the day after, because sperm can survive several days and an egg lives about a day. A positive LH test or a sustained temperature rise you log refines the estimate.',
      ] },
    ],
  },
  {
    slug: 'ovulation-basics',
    category: 'ovulation',
    title: 'Ovulation, and why calendars can only estimate it',
    summary: 'A predicted fertile window is not proof of ovulation. Here’s why.',
    minutes: 4,
    drafted: '2026-10-22',
    sources: [S.wilcox, S.nichdFert, S.nhsTtc],
    sections: [
      { body: [
        'Ovulation is when an ovary releases an egg. It usually happens once per cycle, roughly 12 to 16 days before the next period. Because that gap varies between people and cycles, any calendar estimate carries uncertainty.',
        'Ovulation can be earlier or later than expected, and some cycles have no ovulation at all. A calendar cannot tell these apart.',
      ] },
      { heading: 'Signs that add information', body: [
        'LH tests detect the hormone surge that usually comes 24 to 36 hours before ovulation. A positive result suggests ovulation is likely soon, but does not confirm it.',
        'Basal body temperature rises slightly after ovulation and stays higher. It can only show ovulation after the fact, and illness, alcohol and broken sleep can affect it.',
        'Cervical mucus often becomes clear, slippery and stretchy in the days before ovulation.',
      ] },
      { heading: 'Important', body: [
        'Ondessa is not a contraceptive method. Do not use its fertile-window estimate to avoid pregnancy.',
      ] },
    ],
  },
  {
    slug: 'timing-for-conception',
    category: 'conceiving',
    title: 'Timing sex when trying to conceive',
    summary: 'The most fertile days are the few before ovulation, not after.',
    minutes: 3,
    drafted: '2026-10-22',
    sources: [S.wilcox, S.asrm, S.nhsTtc],
    sections: [
      { body: [
        'Research following couples day by day found that pregnancy was most likely when sex happened in the 5 days before ovulation and on the day of ovulation itself.',
        'Because ovulation is hard to pinpoint, common guidance suggests sex every 1 to 2 days through the fertile window, or every 2 to 3 days throughout the cycle, rather than aiming for one “perfect” day.',
      ] },
      { heading: 'When to ask for help', body: [
        'Common guidance is to talk to a doctor after 12 months of trying if you are under 35, after 6 months if you are 35 or older, or sooner if cycles are very irregular, absent, or you have a known condition. These are general guidelines; a doctor can advise for your situation.',
        'Ondessa cannot assess or diagnose fertility.',
      ] },
    ],
  },
  {
    slug: 'when-to-test',
    category: 'conceiving',
    title: 'When to take a pregnancy test',
    summary: 'Home tests are most reliable from the first day of a missed period.',
    minutes: 2,
    drafted: '2026-10-22',
    sources: [S.nhsPreg, S.nhsTtc],
    sections: [
      { body: [
        'Most home pregnancy tests are most reliable from the first day your period is expected, or about 3 weeks after unprotected sex if your cycles are irregular. Testing earlier increases the chance of a negative result even if you are pregnant.',
        'Ondessa can remind you on a date you choose. It cannot confirm or rule out pregnancy.',
      ] },
    ],
  },
  {
    slug: 'due-date-explained',
    category: 'pregnancy',
    title: 'How a due date is estimated',
    summary: 'A due date is an estimate. An ultrasound or the date from your doctor or midwife is more accurate.',
    minutes: 3,
    drafted: '2026-10-22',
    sources: [S.acogDue, S.nhsPreg],
    sections: [
      { body: [
        'The classic estimate adds 280 days (40 weeks) to the first day of your last period. This assumes ovulation around day 14, so Ondessa adjusts it slightly when your usual cycle is shorter or longer.',
        'An early ultrasound is considered more accurate. If your doctor or midwife gives you a due date, enter it in Ondessa and it will replace the period-based estimate.',
        'Only a small share of babies arrive on the due date itself. Birth between 37 and 42 weeks is common.',
      ] },
    ],
  },
  {
    slug: 'pregnancy-when-to-call',
    category: 'care',
    title: 'In pregnancy: when to contact a professional',
    summary: 'Some symptoms need prompt attention. If in doubt, call.',
    minutes: 2,
    drafted: '2026-10-22',
    sources: [S.nhsUrgent, S.nhsPreg],
    sections: [
      { body: [
        'Contact your midwife, doctor or emergency services promptly if you have vaginal bleeding, severe or persistent abdominal pain, fluid leaking from the vagina, a severe headache with vision changes or swelling of the face and hands, a high temperature, or if your baby’s movements change or slow down later in pregnancy.',
        'If you think it may be an emergency, call your local emergency number. Ondessa cannot assess symptoms.',
      ] },
    ],
  },
  {
    slug: 'perimenopause-basics',
    category: 'perimenopause',
    title: 'Perimenopause: the years of change',
    summary: 'Cycles often become less predictable for several years before periods stop.',
    minutes: 3,
    drafted: '2026-10-22',
    sources: [S.nhsPeri, S.nams],
    sections: [
      { body: [
        'Perimenopause is the transition before menopause, often starting in the 40s and lasting several years. Menopause itself is confirmed after 12 months without a period.',
        'Common changes include cycles that become shorter, longer or skipped, heavier or lighter bleeding, hot flushes, night sweats, sleep changes and mood changes.',
        'Pregnancy is still possible during perimenopause.',
      ] },
      { heading: 'How Ondessa helps', body: [
        'In perimenopause mode, Ondessa keeps predictions wide and honest, and focuses on helping you see your own changes over time, which can be useful to bring to a doctor.',
      ] },
    ],
  },
  {
    slug: 'pms-and-patterns',
    category: 'symptoms',
    title: 'PMS: symptoms that follow your cycle',
    summary: 'Symptoms that reliably show up before your period, and ease after it starts.',
    minutes: 3,
    drafted: '2026-10-22',
    sources: [S.nhsPms, S.acogCycle],
    sections: [
      { body: [
        'Premenstrual symptoms can include bloating, breast tenderness, headaches, mood changes, tiredness and cravings, typically in the week or two before a period.',
        'Logging for a few cycles is the most reliable way to see whether a symptom is linked to your cycle. Ondessa will show you a pattern only once it appears in most of your recent logged cycles, and will say how many.',
        'If symptoms seriously affect your life, a doctor can help. Severe mood symptoms before periods can be a treatable condition called PMDD.',
      ] },
    ],
  },
  {
    slug: 'period-pain',
    category: 'symptoms',
    title: 'Period pain: what’s common and what isn’t',
    summary: 'Cramping is common. Pain that stops you living your life is worth checking.',
    minutes: 2,
    drafted: '2026-10-22',
    sources: [S.nhsPainful],
    sections: [
      { body: [
        'Cramping in the lower belly, sometimes spreading to the back and thighs, is common in the first days of a period.',
        'See a doctor if pain is severe, gets worse over time, stops you from doing everyday things, or happens outside your period or during sex. Conditions such as endometriosis can be underdiagnosed.',
      ] },
    ],
  },
  {
    slug: 'when-to-see-someone',
    category: 'care',
    title: 'Cycle changes worth checking',
    summary: 'Many causes are harmless, but some changes deserve a conversation.',
    minutes: 2,
    drafted: '2026-10-22',
    sources: [S.figo, S.nhsHeavy, S.nhsPeriods],
    sections: [
      { body: [
        'Consider talking to a doctor if: you have had no period for 3 months and are not pregnant, breastfeeding or in menopause; your cycles are regularly shorter than 24 or longer than 38 days; bleeding lasts more than 8 days, or is heavy enough to soak through protection every hour or two; you bleed between periods or after sex; or you bleed after menopause.',
        'Seek urgent care for very heavy bleeding with dizziness or faintness, or sudden severe pain.',
      ] },
    ],
  },
];


/** Week-by-week pregnancy notes, grouped. General information only. */
export const PREGNANCY_WEEKS: { from: number; to: number; title: string; baby: string; you: string }[] = [
  { from: 0, to: 3, title: 'Before a positive test', baby: 'Pregnancy is counted from the first day of your last period, so the first two weeks happen before conception.', you: 'Many people do not know they are pregnant yet. Health services often recommend folic acid before and in early pregnancy.' },
  { from: 4, to: 7, title: 'Early weeks', baby: 'The embryo implants and early structures, including the beginnings of the heart and neural tube, start to form.', you: 'Tiredness, nausea, breast tenderness and needing to pee more are common. This is a good time to contact a doctor or midwife to book care.' },
  { from: 8, to: 13, title: 'Through the first trimester', baby: 'Major organs continue forming. By the end of this stage the fetus is a few centimetres long.', you: 'Nausea often begins to ease towards the end of this stage. A dating scan is commonly offered around now.' },
  { from: 14, to: 19, title: 'Early second trimester', baby: 'Growth speeds up and movements begin, though they may not be felt yet.', you: 'Many people feel more energetic. Some begin to feel first movements around 16 to 20 weeks.' },
  { from: 20, to: 27, title: 'Mid-pregnancy', baby: 'The fetus grows steadily and responds to sound. A detailed anatomy scan is commonly offered around 20 weeks.', you: 'Movements become more noticeable. Back ache and heartburn are common.' },
  { from: 28, to: 33, title: 'Early third trimester', baby: 'Fat stores build and the lungs keep maturing.', you: 'Get to know your baby’s usual pattern of movement. Contact your maternity team promptly if movements slow down or change.' },
  { from: 34, to: 36, title: 'Getting ready', baby: 'Most babies settle head-down by this stage.', you: 'Tiredness, breathlessness and broken sleep are common. Your care team may discuss birth plans.' },
  { from: 37, to: 42, title: 'Full term', baby: 'Babies born from 37 weeks are considered term.', you: 'Labour can start any time. Contact your maternity team with any concerns, including reduced movements or fluid leaking.' },
];

export function weekNotes(week: number) {
  return PREGNANCY_WEEKS.find((w) => week >= w.from && week <= w.to) ?? PREGNANCY_WEEKS[PREGNANCY_WEEKS.length - 1]!;
}
