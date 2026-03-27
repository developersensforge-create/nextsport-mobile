export type DrillLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type DrillCategory =
  | 'Stance & Setup'
  | 'Hip Rotation'
  | 'Bat Path'
  | 'Contact Point'
  | 'Follow Through'
  | 'Infield Fundamentals'
  | 'Pitching Mechanics'
  | 'Pitching Power';

export type DrillTopic = 'Batting' | 'Fielding' | 'Pitching';

export interface ReferenceVideo {
  url: string;
  title: string;
  creator: string;
  note?: string; // e.g. "Watch 0:20 – 1:41"
}

export interface Drill {
  id: string;
  title: string;
  topic: DrillTopic;
  category: DrillCategory;
  level: DrillLevel;
  duration: string;
  reps: string;
  icon: string;
  description: string;
  steps: string[];
  coachTip: string;
  equipment?: string;
  referenceVideo?: ReferenceVideo;
}

export const DRILLS: Drill[] = [
  // ── BATTING — Stance & Setup ──────────────────────────────────────
  {
    id: 'stance-01',
    title: 'Athletic Stance Hold',
    topic: 'Batting',
    category: 'Stance & Setup',
    level: 'Beginner',
    duration: '5 min',
    reps: '3 sets × 30 sec hold',
    icon: 'body-outline',
    equipment: 'Bat only',
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
    topic: 'Batting',
    category: 'Stance & Setup',
    level: 'Beginner',
    duration: '8 min',
    reps: '20 reps',
    icon: 'footsteps-outline',
    equipment: 'Bat only',
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

  // ── BATTING — Hip Rotation ─────────────────────────────────────────
  {
    id: 'hip-01',
    title: 'Hip Rotation Wall Drill',
    topic: 'Batting',
    category: 'Hip Rotation',
    level: 'Beginner',
    duration: '8 min',
    reps: '3 sets × 15 reps',
    icon: 'sync-outline',
    equipment: 'None',
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
    topic: 'Batting',
    category: 'Hip Rotation',
    level: 'Intermediate',
    duration: '12 min',
    reps: '4 sets × 10 swings',
    icon: 'flash-outline',
    equipment: 'Bat, Ball, Tee',
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
    topic: 'Batting',
    category: 'Hip Rotation',
    level: 'Advanced',
    duration: '15 min',
    reps: '3 sets × 12 reps',
    icon: 'fitness-outline',
    equipment: 'Resistance Band',
    description: 'Add resistance to build rotational power and improve separation between hips and shoulders.',
    steps: [
      'Anchor a light resistance band to a fence/pole at hip height.',
      'Loop band around waist, stand so tension pulls from your back side.',
      'Load into your back hip against the band\'s resistance.',
      'Drive hips forward — let the band add challenge to your rotation.',
      'Hold finish position 2 seconds. Reset slowly.',
    ],
    coachTip: 'Go lighter than you think — the goal is speed of rotation, not fighting the band.',
    referenceVideo: {
      url: 'https://youtu.be/VAk5WHHd26s?si=Xi9jpGtI6Vayo3z7&t=46',
      title: 'Resistance Band Exercises | Hitting Done Right',
      creator: 'Hitting Done Right - HDR',
      note: 'Watch 0:46 – 2:20 — focuses on rotating before the swing',
    },
  },

  // ── BATTING — Bat Path ────────────────────────────────────────────
  {
    id: 'batpath-01',
    title: 'PVC Pipe Mechanics Drill',
    topic: 'Batting',
    category: 'Bat Path',
    level: 'Beginner',
    duration: '10 min',
    reps: '3 sets × 15 reps',
    icon: 'baseball-outline',
    equipment: 'PVC Pipe or Broomstick',
    description: 'Use a PVC pipe to drill clean swing mechanics — immediate feedback on path and contact.',
    steps: [
      'Hold a PVC pipe or broomstick like a bat.',
      'Take your normal stance and swing at half speed.',
      'Focus on knob-first path: drive the bottom of the pipe toward the ball first.',
      'At contact, the pipe should be flat through the zone — not looping up or chopping down.',
      'Increase speed as your path feels clean.',
    ],
    coachTip: 'The pipe is lighter so bad habits show up faster. If the path feels off, slow down — don\'t let speed hide the flaw.',
    referenceVideo: {
      url: 'https://youtu.be/CPzMopFu95M?si=Sys4zD8W4xaxvHs9&t=20',
      title: 'Top 5 PVC Hitting Drills - At Home Baseball Drills',
      creator: 'Northern Baseball Training',
      note: 'Watch 0:20 – 1:41',
    },
  },
  {
    id: 'batpath-02',
    title: 'Connection Ball Tee Drill',
    topic: 'Batting',
    category: 'Bat Path',
    level: 'Beginner',
    duration: '10 min',
    reps: '3 sets × 12 swings',
    icon: 'radio-button-on-outline',
    equipment: 'Bat, Ball, Tee',
    description: 'Keep your swing connected by stopping the arms from casting away from the body early.',
    steps: [
      'Set up at a tee with ball at belt height.',
      'Place a small ball or towel between your front arm and chest.',
      'Swing normally — if the ball drops before contact, your arm disconnected too early.',
      'Focus: keep that connection through the swing zone.',
      'Try 12 swings keeping the ball in place all the way through contact.',
    ],
    coachTip: 'Casting (letting the arms fly away) is the #1 cause of weak contact. This drill exposes it immediately.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/qYyfGdm-YNc?si=lmQYqzXMnND1LItT',
      title: 'Great Connection Ball Hitting Drill',
      creator: 'TheBullpenTraining',
      note: 'Full video demonstration',
    },
  },
  {
    id: 'batpath-03',
    title: 'One-Hand Bat Path (Top/Bottom)',
    topic: 'Batting',
    category: 'Bat Path',
    level: 'Intermediate',
    duration: '10 min',
    reps: '3 sets × 10 per hand',
    icon: 'hand-right-outline',
    equipment: 'Bat, Tee, Ball',
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

  // ── BATTING — Batting Power ───────────────────────────────────────
  {
    id: 'batpower-01',
    title: 'Med Ball Rotational Throw',
    topic: 'Batting',
    category: 'Hip Rotation',
    level: 'Intermediate',
    duration: '12 min',
    reps: '3 sets × 10 throws',
    icon: 'golf-outline',
    equipment: 'Medicine Ball',
    description: 'Build explosive rotational power by training your legs and hips to drive the swing.',
    steps: [
      'Hold a light med ball (4–6 lbs) in your batting stance.',
      'Load into your back hip like you\'re loading a swing.',
      'Explosively rotate hips and throw the med ball into a wall or to a partner.',
      'The throw should come from your LEGS and hips — not your arms.',
      'Catch the rebound or reset. Repeat.',
    ],
    coachTip: 'If your arms are sore after this, you\'re throwing with your arms. Drive from the legs. The arms just hold the ball.',
    referenceVideo: {
      url: 'https://youtu.be/r9fs-HGCZTs?si=nRNK09svz3WK0Cjx&t=149',
      title: 'Medicine Ball Drills to Increase Bat Speed and Power',
      creator: 'AntonelliBaseball',
      note: 'Watch 2:29 – 2:59 — the legs drive the rotation',
    },
  },

  // ── BATTING — Contact Point ───────────────────────────────────────
  {
    id: 'contact-01',
    title: 'Tee Zone Mapping',
    topic: 'Batting',
    category: 'Contact Point',
    level: 'Beginner',
    duration: '12 min',
    reps: '10 swings per zone',
    icon: 'map-outline',
    equipment: 'Bat, Ball, Tee',
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

  // ── BATTING — Follow Through ──────────────────────────────────────
  {
    id: 'follow-01',
    title: 'Full Extension Finish',
    topic: 'Batting',
    category: 'Follow Through',
    level: 'Beginner',
    duration: '8 min',
    reps: '3 sets × 15 slow swings',
    icon: 'flag-outline',
    equipment: 'Bat only',
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

  // ── FIELDING — Infield Fundamentals ──────────────────────────────
  {
    id: 'field-01',
    title: 'Bare Hands Ground Ball Reps',
    topic: 'Fielding',
    category: 'Infield Fundamentals',
    level: 'Beginner',
    duration: '10 min',
    reps: '3 sets × 15 reps',
    icon: 'hand-left-outline',
    equipment: 'Baseball only',
    description: 'Build feel and soft hands by fielding ground balls without a glove — forces proper technique.',
    steps: [
      'Bounce a baseball off a flat concrete wall or have a partner roll grounders.',
      'Field the ball with bare hands — stay low, field out front.',
      'Use the "alligator" technique: bottom hand scoops, top hand closes.',
      'Focus on soft hands — let the ball come to you, don\'t stab at it.',
      'Start slow, get faster as hands get comfortable.',
    ],
    coachTip: 'Bare hands immediately reveals if you\'re stabbing at the ball. Your hands will get stung if your technique is wrong — that\'s the feedback.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/S3PWpGER43I?si=KG-R9SEBFaXuSdmQ',
      title: 'Easy Infield Drills You Can Do At Home By Yourself',
      creator: 'AntonelliBaseball',
      note: 'Full video',
    },
  },
  {
    id: 'field-02',
    title: 'Straight-Up Fielding',
    topic: 'Fielding',
    category: 'Infield Fundamentals',
    level: 'Beginner',
    duration: '8 min',
    reps: '20 reps',
    icon: 'arrow-up-outline',
    equipment: 'Baseball only',
    description: 'Train footwork and timing on straight-on short hops — the most common play in infield.',
    steps: [
      'Stand 6–8 feet from a wall. Throw a baseball against it firmly.',
      'Field the short hop directly in front of you as it comes back.',
      'Move your feet to get in front of the ball — never field from your side.',
      'Focus on the timing: read the hop early, feet set before the ball arrives.',
      'Repeat 20 times, increasing throw force gradually.',
    ],
    coachTip: 'The worst fielders react late and reach. The best ones read the hop before it happens and have feet already moving.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/cuEo-QTwmfw?si=yldIt4SWIXV-Dm02',
      title: 'Top 3 At Home Infield Drills',
      creator: 'NorthernBaseballTraining',
      note: 'Watch from start — 0:02 mark',
    },
  },
  {
    id: 'field-03',
    title: 'Backhand Fielding',
    topic: 'Fielding',
    category: 'Infield Fundamentals',
    level: 'Intermediate',
    duration: '8 min',
    reps: '15 reps each side',
    icon: 'return-down-back-outline',
    equipment: 'Baseball only',
    description: 'Develop the backhand range that separates good infielders from great ones.',
    steps: [
      'Stand 6 feet from a wall. Throw ball to your glove-hand side.',
      'Step with your throwing-side foot to move laterally (backhand direction).',
      'Field the ball on your backhand — glove facing down, wrist firm.',
      'Immediately get into throw position after fielding.',
      'Repeat 15 times. Then switch to forehand side.',
    ],
    coachTip: 'The backhand is all about the crossover step. If your first step is wrong, the play is over before it starts.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/cuEo-QTwmfw?si=yldIt4SWIXV-Dm02',
      title: 'Top 3 At Home Infield Drills',
      creator: 'NorthernBaseballTraining',
      note: 'Watch 0:02 – 0:05 mark (backhand segment)',
    },
  },
  {
    id: 'field-04',
    title: 'Forehand Fielding',
    topic: 'Fielding',
    category: 'Infield Fundamentals',
    level: 'Intermediate',
    duration: '8 min',
    reps: '15 reps',
    icon: 'arrow-forward-outline',
    equipment: 'Baseball only',
    description: 'Build the forehand range for balls hit to your glove side.',
    steps: [
      'Stand 6 feet from a wall. Throw ball to your glove-hand side (forehand).',
      'Step with your glove-side foot to move laterally.',
      'Field the ball on your forehand — glove palm up, reach across body.',
      'Stay low through the entire movement.',
      'Immediately reset to throwing position.',
    ],
    coachTip: 'On the forehand, you\'re almost always fielding on the run. Train your body to field and redirect in one smooth motion.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/cuEo-QTwmfw?si=yldIt4SWIXV-Dm02',
      title: 'Top 3 At Home Infield Drills',
      creator: 'NorthernBaseballTraining',
      note: 'Watch 0:06 – 0:09 mark (forehand segment)',
    },
  },

  // ── PITCHING — Mechanics ──────────────────────────────────────────
  {
    id: 'pitch-01',
    title: 'Towel Release Point Drill',
    topic: 'Pitching',
    category: 'Pitching Mechanics',
    level: 'Beginner',
    duration: '10 min',
    reps: '3 sets × 15 reps',
    icon: 'water-outline',
    equipment: 'Towel (no ball needed)',
    description: 'Fix early release and improve extension by training your arm to stay in front at release.',
    steps: [
      'Fold a hand towel and grip it like a baseball in your throwing hand.',
      'Get into your pitching stance on flat ground.',
      'Go through your full pitching motion. At release, snap the towel forward.',
      'The towel should "slap" out in front of your body — not on the side.',
      'If the slap is to the side, you\'re releasing early. Focus on staying tall and driving toward the plate.',
    ],
    coachTip: 'The towel slap point is your release point. Most youth pitchers release way too early and to the side — this drill makes that impossible to hide.',
    referenceVideo: {
      url: 'https://youtu.be/ImeXGqKYP7Y?si=3XNK9Iv-VCo1EPkn&t=202',
      title: '9 Best Baseball Pitching Drills for Kids',
      creator: 'yougotmojo',
      note: 'Watch 3:22 – 4:30 — Towel Slap drill segment',
    },
  },
  {
    id: 'pitch-02',
    title: 'Back Leg Drive Drill',
    topic: 'Pitching',
    category: 'Pitching Mechanics',
    level: 'Intermediate',
    duration: '10 min',
    reps: '20 reps',
    icon: 'trending-up-outline',
    equipment: 'Glove, Ball',
    description: 'Generate more velocity by training explosive back-leg push-off from the rubber.',
    steps: [
      'Start in your set position on flat ground (no mound needed).',
      'Focus on loading your weight fully into your back leg.',
      'Explode forward — push hard off that back leg, driving toward the catcher.',
      'Feel the separation: hips open while your upper body stays back briefly.',
      'Finish with your back foot coming off the ground completely.',
    ],
    coachTip: 'Velocity starts in your legs. If your back foot stays on the ground during delivery, you\'re leaving speed on the table.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/HS2VA04f3vo?si=lvxVYQTo_YBWRtd',
      title: 'Try This 1 Pitching Drill For Better Back Leg Drive',
      creator: 'ARMPitchingDevelopment',
      note: 'Full video',
    },
  },

  // ── PITCHING — Power ─────────────────────────────────────────────
  {
    id: 'pitch-03',
    title: 'Med Ball Pitching Power',
    topic: 'Pitching',
    category: 'Pitching Power',
    level: 'Intermediate',
    duration: '12 min',
    reps: '3 sets × 10 throws',
    icon: 'rocket-outline',
    equipment: 'Medicine Ball',
    description: 'Build the lower-body and rotational power that directly translates to pitching velocity.',
    steps: [
      'Hold a light med ball (4–6 lbs) in your pitching hand.',
      'Go through your pitching motion — full windup or stretch.',
      'Throw the ball into a wall or net, driving from your legs.',
      'Focus on the chain: back leg → hip → torso → arm.',
      'This is NOT about arm strength. Every rep should feel leg-powered.',
    ],
    coachTip: 'Most youth pitchers throw with their arm and forget their legs exist. If this drill makes your legs tired, you\'re doing it right.',
    referenceVideo: {
      url: 'https://youtu.be/nstQNE_GUXA?si=z0xd_p_t_nMepSwC',
      title: 'Large Med Ball Drill: Improve Pitching Mechanics & Velocity',
      creator: 'Paradigm Pitching',
      note: 'Full video',
    },
  },
  {
    id: 'pitch-04',
    title: 'J-Band Arm Warmup',
    topic: 'Pitching',
    category: 'Pitching Power',
    level: 'Beginner',
    duration: '8 min',
    reps: '10 reps per movement',
    icon: 'bandage-outline',
    equipment: 'Resistance Band (J-Bands)',
    description: 'Pre-throwing arm prep routine that activates key pitching muscles and prevents injury.',
    steps: [
      'Anchor band and work through: triceps extension, lat stretch, forward fly.',
      'Chest press: 10 reps, focus on full extension.',
      '2-Way Row: pull toward body, slow and controlled.',
      'YTLA Raise: Y, T, L, A positions — hold each 2 seconds.',
      '2-Way Shoulder IR/ER: internal and external rotation, 10 each.',
    ],
    coachTip: 'Do this BEFORE every throwing session. Pitchers who skip their band work are the ones who get hurt in April.',
    referenceVideo: {
      url: 'https://youtube.com/shorts/mEkXvUV5Crw?si=dMpE9ws8w4WBOglW',
      title: 'Our Top J-Bands Pre-Throwing Movements',
      creator: 'treadathletics',
      note: 'Full video — shows all 10 movements',
    },
  },
];

export const TOPICS: DrillTopic[] = ['Batting', 'Fielding', 'Pitching'];

export const TOPIC_ICONS: Record<DrillTopic, string> = {
  Batting: 'baseball-outline',
  Fielding: 'hand-left-outline',
  Pitching: 'rocket-outline',
};

export const CATEGORIES_BY_TOPIC: Record<DrillTopic, DrillCategory[]> = {
  Batting: ['Stance & Setup', 'Hip Rotation', 'Bat Path', 'Contact Point', 'Follow Through'],
  Fielding: ['Infield Fundamentals'],
  Pitching: ['Pitching Mechanics', 'Pitching Power'],
};

export const LEVEL_COLORS: Record<DrillLevel, string> = {
  Beginner: '#22c55e',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

export const TOPIC_COLORS: Record<DrillTopic, string> = {
  Batting: '#3b82f6',
  Fielding: '#8b5cf6',
  Pitching: '#f97316',
};
