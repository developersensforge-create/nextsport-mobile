export type DrillLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type DrillCategory = 'Stance & Setup' | 'Hip Rotation' | 'Bat Path' | 'Contact Point' | 'Follow Through';

export interface Drill {
  id: string;
  title: string;
  category: DrillCategory;
  level: DrillLevel;
  duration: string; // e.g. "10 min"
  reps: string;     // e.g. "3 sets × 15 reps"
  icon: string;     // Ionicons name
  description: string;
  steps: string[];
  coachTip: string;
}

export const DRILLS: Drill[] = [
  // ── Stance & Setup ──────────────────────────────────────────────
  {
    id: 'stance-01',
    title: 'Athletic Stance Hold',
    category: 'Stance & Setup',
    level: 'Beginner',
    duration: '5 min',
    reps: '3 sets × 30 sec hold',
    icon: 'body-outline',
    description: 'Build muscle memory for a balanced, athletic starting position before every swing.',
    steps: [
      'Stand with feet shoulder-width apart, toes slightly outward.',
      'Bend knees until you feel weight in the balls of your feet.',
      'Hold bat at 45° angle behind your rear shoulder — keep elbows down.',
      'Chin over front shoulder. Eyes level. Hold for 30 seconds.',
      'Rest 15 seconds. Repeat 3 times.',
    ],
    coachTip: 'Imagine you\'re about to catch a basketball — that alert, coiled feeling is exactly the stance you want.',
  },
  {
    id: 'stance-02',
    title: 'Stride Timing Drill',
    category: 'Stance & Setup',
    level: 'Beginner',
    duration: '8 min',
    reps: '20 reps',
    icon: 'footsteps-outline',
    description: 'Train a consistent, short stride so your weight transfer is under control.',
    steps: [
      'Get into your batting stance.',
      'Without swinging, take your normal stride forward (4–6 inches max).',
      'Land softly on the ball of your front foot — heel down last.',
      'Pause for 1 second. Return to start. Repeat.',
      'Focus on landing in the same spot every time.',
    ],
    coachTip: 'The stride should be quiet and controlled — no lunging. Think "step to hit," not "step then hit."',
  },

  // ── Hip Rotation ─────────────────────────────────────────────────
  {
    id: 'hip-01',
    title: 'Hip Rotation Wall Drill',
    category: 'Hip Rotation',
    level: 'Beginner',
    duration: '8 min',
    reps: '3 sets × 15 reps',
    icon: 'sync-outline',
    description: 'Isolate hip rotation without arm interference — feel the engine of your swing.',
    steps: [
      'Stand an arm\'s length from a wall, facing it.',
      'Cross arms over chest (no bat needed).',
      'Rotate hips explosively toward the wall, stopping before your hands touch it.',
      'Feel your back heel lift and your hips open fully.',
      'Reset and repeat at a controlled pace.',
    ],
    coachTip: 'Your hips should fire BEFORE your shoulders rotate. Think "hips open, then hands follow."',
  },
  {
    id: 'hip-02',
    title: 'Tee Hip Drive',
    category: 'Hip Rotation',
    level: 'Intermediate',
    duration: '12 min',
    reps: '4 sets × 10 swings',
    icon: 'flash-outline',
    description: 'Combine hip rotation with a real swing at a tee to build explosive power.',
    steps: [
      'Set tee at belt height, ball in the middle of your hitting zone.',
      'Take your stance. Pause. Initiate the swing with your back hip driving forward.',
      'Feel hips clear before the bat comes through.',
      'Swing through the ball — don\'t just hit it, drive through it.',
      'Check: back foot should be on its toe at finish, belt buckle facing pitcher.',
    ],
    coachTip: 'Place your hand on your back hip before swinging. Feel it push forward first — that\'s the sequence you\'re training.',
  },
  {
    id: 'hip-03',
    title: 'Resistance Band Hip Load',
    category: 'Hip Rotation',
    level: 'Advanced',
    duration: '15 min',
    reps: '3 sets × 12 reps',
    icon: 'fitness-outline',
    description: 'Add resistance to build rotational power and improve separation between hips and shoulders.',
    steps: [
      'Anchor a light resistance band to a fence/pole at hip height.',
      'Loop band around waist, stand so tension pulls from your back side.',
      'Load into your back hip against the band\'s resistance.',
      'Drive hips forward — let the band add challenge to your rotation.',
      'Hold finish position 2 seconds. Reset slowly.',
    ],
    coachTip: 'Go lighter than you think — the goal is speed of rotation, not fighting the band.',
  },

  // ── Bat Path ──────────────────────────────────────────────────────
  {
    id: 'batpath-01',
    title: 'Knob to Ball Drill',
    category: 'Bat Path',
    level: 'Beginner',
    duration: '10 min',
    reps: '3 sets × 15 reps',
    icon: 'baseball-outline',
    description: 'Fix a long, loopy swing by training your hands to take the shortest path to the ball.',
    steps: [
      'Set up at a tee, ball at belt height.',
      'Start your swing — focus on driving the KNOB of the bat toward the ball first.',
      'Keep your back elbow tight to your body as hands come forward.',
      'Only after the knob passes the hip should the barrel come through.',
      'Hit through the ball, not at it.',
    ],
    coachTip: 'If you can feel your elbow leaving your body early, that\'s the leak. Keep it tucked like you\'re cracking a walnut.',
  },
  {
    id: 'batpath-02',
    title: 'One-Hand Bat Path (Top Hand)',
    category: 'Bat Path',
    level: 'Intermediate',
    duration: '10 min',
    reps: '3 sets × 10 per hand',
    icon: 'hand-right-outline',
    description: 'Isolate each hand to diagnose and fix swing path issues independently.',
    steps: [
      'Use a lighter bat or training bat.',
      'Grip with TOP hand only (dominant hand). Bottom hand behind back.',
      'Swing at a tee ball — feel how your top hand controls bat path.',
      'Switch: BOTTOM hand only. Feel how it guides the barrel through the zone.',
      'Put it together: notice if one hand is dominating incorrectly.',
    ],
    coachTip: 'Most hitters are too top-hand dominant. The bottom hand is the guide — the top hand is the finisher.',
  },
  {
    id: 'batpath-03',
    title: 'Inside-Out Contact Drill',
    category: 'Bat Path',
    level: 'Advanced',
    duration: '15 min',
    reps: '4 sets × 10 swings',
    icon: 'git-branch-outline',
    description: 'Train an inside-out swing path that drives the ball to the opposite field with authority.',
    steps: [
      'Move tee to simulate an inside pitch location.',
      'Focus on keeping hands inside the ball — barrel stays behind hands longer.',
      'Drive the ball to the opposite field (right-center for righties).',
      'If you\'re pulling everything, your path is too far around — reset.',
      'Goal: consistent contact to opposite field with good exit velocity.',
    ],
    coachTip: 'This is one of the hardest drills to master. Even pros work this. If you\'re hitting it solid to the opposite field, your path is elite.',
  },

  // ── Contact Point ─────────────────────────────────────────────────
  {
    id: 'contact-01',
    title: 'Tee Zone Mapping',
    category: 'Contact Point',
    level: 'Beginner',
    duration: '12 min',
    reps: '10 swings per zone',
    icon: 'map-outline',
    description: 'Learn exactly where your contact point should be for inside, middle, and outside pitches.',
    steps: [
      'Set tee for an inside pitch (over front of plate). Swing and hit. Note contact point.',
      'Move tee to middle of plate. Swing. The ball should be hit just in front of your hip.',
      'Move tee to outside edge. Swing. Contact should be deeper, near your back hip.',
      'Repeat each zone 10 times. Film yourself to see if contact matches the zone.',
      'The key: don\'t try to pull outside pitches. Let them get deep.',
    ],
    coachTip: 'Inside → out front. Middle → even with hip. Outside → slightly behind hip. This is the contact point triangle.',
  },
  {
    id: 'contact-02',
    title: 'Soft Toss Reaction',
    category: 'Contact Point',
    level: 'Intermediate',
    duration: '15 min',
    reps: '5 sets × 8 tosses',
    icon: 'radio-button-on-outline',
    description: 'Build eyes-to-hands connection with a partner doing soft toss from the side.',
    steps: [
      'Partner kneels to your side (front hip side), 3–4 feet away.',
      'Partner tosses ball underhand into your hitting zone.',
      'Track the ball from the toss — find it early, swing through.',
      'Focus: don\'t start swing until you\'ve picked up the ball.',
      'Call out "inside," "middle," or "outside" as ball arrives.',
    ],
    coachTip: 'The verbal call forces your brain to actually read the pitch location. Silent hitters often guess — you want to react.',
  },

  // ── Follow Through ────────────────────────────────────────────────
  {
    id: 'follow-01',
    title: 'Full Extension Finish',
    category: 'Follow Through',
    level: 'Beginner',
    duration: '8 min',
    reps: '3 sets × 15 slow swings',
    icon: 'flag-outline',
    description: 'Ingrain a complete, balanced finish position for maximum power and consistency.',
    steps: [
      'Take a normal swing at a tee — but slow it down to 50% speed.',
      'At contact, keep driving the bat through. Don\'t stop at the ball.',
      'Let the bat wrap around your body. Both hands should finish high.',
      'Hold the finish for 3 seconds. Check: back foot on toe, weight on front leg, balanced.',
      'Repeat. Speed up gradually while keeping the finish clean.',
    ],
    coachTip: 'A good finish is proof of a good swing. If your finish is off-balance or your arms are bent awkwardly, work backward to find the breakdown.',
  },
  {
    id: 'follow-02',
    title: 'High Finish Hold',
    category: 'Follow Through',
    level: 'Intermediate',
    duration: '10 min',
    reps: '20 reps',
    icon: 'trophy-outline',
    description: 'Build muscle memory for a consistent, high follow-through that maximizes bat speed.',
    steps: [
      'Start in your stance. No ball needed.',
      'Swing at full speed through the imaginary ball.',
      'Finish with both hands above your front shoulder, bat pointing toward the outfield.',
      'Freeze in that position for 3 seconds. Film yourself from behind.',
      'Check your finish looks like your favorite MLB hitter\'s. Repeat.',
    ],
    coachTip: 'Trout, Harper, Betts — watch their finishes on YouTube. Then mimic it exactly. Elite hitters all finish similarly for a reason.',
  },
];

export const CATEGORIES: DrillCategory[] = [
  'Stance & Setup',
  'Hip Rotation',
  'Bat Path',
  'Contact Point',
  'Follow Through',
];

export const LEVEL_COLORS: Record<DrillLevel, string> = {
  Beginner: '#22c55e',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};
