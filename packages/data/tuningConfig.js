// packages/data/tuningConfig.js  v2.0
// Per-PI-class restrictions | 5-style auto-detected build system | 4-5 brand variants
// per category | Advanced sliders with zone indicators | Drift mode override

'use strict';

// ─── Part Rarities ───────────────────────────────────────────────────────────
const PART_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const PART_ITEMS = {
    common:    'car_part_common',
    uncommon:  'car_part_uncommon',
    rare:      'car_part_rare',
    epic:      'car_part_epic',
    legendary: 'car_part_legendary'
};

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND REGISTRY — minPIClass: earliest PI class that unlocks this brand
// ═══════════════════════════════════════════════════════════════════════════════
const VARIANT_BRANDS = {
    dinka:    { name:'Dinka',    color:'#00a8ff', tag:'Grip',     desc:'Japanese precision — traction & stability',          minPIClass:'F' },
    bravado:  { name:'Bravado',  color:'#ff4757', tag:'Power',    desc:'American muscle — raw power & speed',               minPIClass:'F' },
    karin:    { name:'Karin',    color:'#ff6b35', tag:'Drift',    desc:'JDM tuner culture — oversteer & angle',             minPIClass:'D' },
    vapid:    { name:'Vapid',    color:'#8aaa30', tag:'Street',   desc:'Versatile street parts — reliable all-rounder',     minPIClass:'F' },
    declasse: { name:'Declasse', color:'#ffaa00', tag:'Drag',     desc:'Drag strip engineering — straight-line dominance',  minPIClass:'C' },
    bison:    { name:'Bison',    color:'#8b5e3c', tag:'Off-Road', desc:'Trail-rated components — built for any terrain',    minPIClass:'D' },
    inverto:  { name:'Inverto',  color:'#c070ff', tag:'Race',     desc:'Italian race engineering — precision at the limit', minPIClass:'B' },
    pfister:  { name:'Pfister',  color:'#ffd700', tag:'Exotic',   desc:'Exotic performance — pinnacle of engineering',      minPIClass:'A' },
    standard: { name:'Standard', color:'#8a8fa6', tag:'OEM',      desc:'Factory specification',                             minPIClass:'F' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD STYLE SYSTEM — 5 auto-detected styles
// ═══════════════════════════════════════════════════════════════════════════════
const BUILD_STYLES = {
    drift:   { name:'Drift Build',    color:'#ff6b35', icon:'🌀', desc:'Loose rear, oversteer, angle hunting'          },
    race:    { name:'Race Build',     color:'#00a8ff', icon:'🏁', desc:'Balanced grip, max cornering precision'        },
    drag:    { name:'Drag Build',     color:'#ff4757', icon:'⚡', desc:'Straight-line power, launch traction'          },
    offroad: { name:'Off-Road Build', color:'#8b5e3c', icon:'🏔', desc:'Suspension travel, all-terrain grip'          },
    street:  { name:'Street Build',   color:'#8aaa30', icon:'🏙', desc:'Versatile all-rounder, accessible performance' },
    balanced:{ name:'Balanced',       color:'#8a8fa6', icon:'⚖',  desc:'No dominant style'                            }
};

const TENDENCY_LABELS = Object.assign({}, BUILD_STYLES, {
    grip:  BUILD_STYLES.race,
    power: BUILD_STYLES.drag
});

// ═══════════════════════════════════════════════════════════════════════════════
// PI CLASS RESTRICTIONS
// ═══════════════════════════════════════════════════════════════════════════════
const PI_CLASS_ORDER          = ['F','E','D','C','B','A','S'];
const PI_CLASS_STAGE_CAPS     = { F:2, E:2, D:3, C:3, B:4, A:5, S:5 };
const PI_SLIDER_RANGE_SCALE   = { F:0.40, E:0.52, D:0.64, C:0.74, B:0.84, A:0.94, S:1.00 };
const DRIFT_MODE_THRESHOLD    = 0.80;
const STYLE_UNLOCK_THRESHOLD  = 0.60;
const OFFROAD_VEHICLE_TYPES   = new Set(['suv','offroad','truck','military','utility']);

// ═══════════════════════════════════════════════════════════════════════════════
// DRIFT MODE — stacked on normal handling when drift tendency >= 80%
// ═══════════════════════════════════════════════════════════════════════════════
const DRIFT_MODE_HANDLING = {
    // Core drift properties — confirmed correct per GTA V handling docs
    fTractionCurveMin:         0.79,  // Reduce sustained grip → sustain slides on tarmac
    fTractionCurveMax:         0.86,  // Reduce peak grip ceiling → initiate slides easier
    fTractionBiasFront:        0.93,  // Slight rear bias → RWD drift feel
    fAntiRollBarForce:         0.76,  // Softer ARB → more weight transfer for initiation
    fSuspensionForce:          0.82,  // Softer → body leans, rear unloads under power
    fHandBrakeForce:           1.32,  // Stronger handbrake → easier entry
    fLowSpeedTractionLossMult: 1.55   // More wheelspin at low speed → easier initiation/burnout
};

// ═══════════════════════════════════════════════════════════════════════════════
// SAFETY CAPS — applied after ALL variant + slider + drift-mode math
// ═══════════════════════════════════════════════════════════════════════════════
const HANDLING_SAFETY_CAPS = {
    fAntiRollBarForce:       { min: 0.50 },
    fSuspensionForce:        { min: 0.55 },
    fRollCentreHeightFront:  { min: 0.66 },
    fRollCentreHeightRear:   { min: 0.66 },
    fSuspensionCompDamp:     { min: 0.50 },
    fSuspensionReboundDamp:  { min: 0.50 },
    fTractionCurveMax:       { min: 0.66 },
    fTractionCurveMin:       { min: 0.60 },
    fTractionBiasFront:      { min: 0.76, max: 1.24 },
    fInitialDriveForce:      { max: 2.10 },
    fBrakeForce:             { max: 2.30 },
    fHandBrakeForce:         { max: 2.60 },
    fTractionLossMult:       { max: 1.70 },
    fLowSpeedTractionLossMult:{ min: 0.20, max: 3.50 }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE MODS
// Slider zone fields:
//   zones:      { safe:[lo,hi], caution:[lo,hi] }
//   styleZones: { drift:[lo,hi], race:[..], ... }
//   warnLow / warnHigh: description strings for caution/danger
// ═══════════════════════════════════════════════════════════════════════════════
const PERFORMANCE_MODS = {

    // ────────────────────────────────────────────────────────────────────────
    //  POWER
    // ────────────────────────────────────────────────────────────────────────

    engine: {
        name:'Engine', icon:'🔧', modType:11, isVirtual:false,
        maxStage:5, group:'power',
        description:[
            'Stock Engine',
            'Stage 1 — Bolt-ons, cold air intake',
            'Stage 2 — Ported heads, headers',
            'Stage 3 — Forged internals',
            'Stage 4 — Built motor, big cams',
            'Stage 5 — Full race engine'
        ],
        variants:{
            vapid:{
                name:'Vapid Street Spec', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.85, minPIClass:'F', tendency:{ street:3 },
                desc:'Budget-friendly tune. Reliable gains without drama.',
                handling:{ fInitialDriveForce:[1.0,1.03,1.08,1.14,1.21,1.29] }
            },
            dinka:{
                name:'Dinka Precision', tag:'Balanced', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Smooth, reliable power delivery across the rev range.',
                handling:{ fInitialDriveForce:[1.0,1.05,1.12,1.20,1.30,1.42] }
            },
            bravado:{
                name:'Bravado Stroker', tag:'Power', tagColor:'#ff4757',
                surcharge:1.25, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Aggressive cam profile. Maximum top-end horsepower.',
                handling:{ fInitialDriveForce:[1.0,1.07,1.15,1.25,1.37,1.52] }
            },
            karin:{
                name:'Karin Torque Setup', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.15, minPIClass:'D', tendency:{ drift:2, street:1 },
                desc:'Fat mid-range torque — power snaps the rear sideways.',
                handling:{
                    fInitialDriveForce:[1.0,1.05,1.11,1.19,1.29,1.40],
                    fTractionLossMult: [1.0,1.02,1.05,1.09,1.13,1.18]
                }
            },
            inverto:{
                name:'Inverto Race Engine', tag:'Race', tagColor:'#c070ff',
                surcharge:1.45, minPIClass:'B', tendency:{ race:3 },
                desc:'High-revving race unit. Every component engineered to the limit. Screams to redline instantly.',
                handling:{
                    fInitialDriveForce:[1.0,1.06,1.14,1.23,1.34,1.47],
                    fDriveInertia:     [1.0,1.04,1.09,1.14,1.20,1.28]
                }
            }
        },
        sliders:[
            {
                key:'powerBand', name:'Power Band', icon:'📊', minStage:2, default:0.5,
                description:'Shift power between low-end torque and high-rev horsepower',
                leftLabel:'Torque', rightLabel:'Horsepower',
                properties:{
                    fInitialDriveForce:{ min:0.03,  max:-0.03 },
                    fDriveInertia:     { min:-0.06, max:0.06  }
                },
                zones:{ safe:[0.20,0.80], caution:[0.10,0.90] },
                styleZones:{ drift:[0.45,0.82], race:[0.38,0.76], drag:[0.58,0.92], offroad:[0.25,0.65], street:[0.28,0.72] },
                warnLow:'Heavy torque focus — strong off-the-line, limited top speed',
                warnHigh:'Extreme high-rev tune — power peaks very late, unforgiving'
            },
            {
                key:'throttleResponse', name:'Throttle Response', icon:'⚡', minStage:3, default:0.5,
                description:'Controls how sharply the engine reacts to throttle input',
                leftLabel:'Smooth', rightLabel:'Snap',
                properties:{ fDriveInertia:{ min:0.07, max:-0.09 } },
                zones:{ safe:[0.22,0.78], caution:[0.10,0.90] },
                styleZones:{ drift:[0.52,0.88], race:[0.48,0.82], drag:[0.62,0.94], offroad:[0.18,0.58], street:[0.28,0.68] },
                warnLow:'Extremely lazy throttle — sluggish corner exit',
                warnHigh:'Hair-trigger snap — can induce sudden oversteer on throttle'
            }
        ]
    },

    turbo:{
        name:'Forced Induction', icon:'🌀', modType:18, isVirtual:false,
        maxStage:3, group:'power',
        description:[
            'Naturally Aspirated',
            'Stage 1 — Small turbo kit',
            'Stage 2 — Mid-frame turbo',
            'Stage 3 — Big turbo / twin setup'
        ],
        variants:{
            vapid:{
                name:'Vapid Economy Turbo', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.85, minPIClass:'F', tendency:{ street:3 },
                desc:'Cheap bolt-on kit. Linear power, no drama.',
                handling:{ fInitialDriveForce:[1.0,1.05,1.11,1.18] }
            },
            dinka:{
                name:'Dinka Twin-Scroll', tag:'Responsive', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Quick-spooling twin scroll. Minimal lag, smooth linear power delivery.',
                handling:{
                    fInitialDriveForce:[1.0,1.06,1.14,1.24],
                    fDriveInertia:     [1.0,1.02,1.04,1.07]
                }
            },
            bravado:{
                name:'Bravado Big Single', tag:'Power', tagColor:'#ff4757',
                surcharge:1.30, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Massive turbo. Explosive top-end with noticeable lag.',
                handling:{ fInitialDriveForce:[1.0,1.10,1.22,1.36] }
            },
            karin:{
                name:'Karin Anti-Lag', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.20, minPIClass:'D', tendency:{ drift:3 },
                desc:'Anti-lag system. Instant spool, pops & bangs, easy wheelspin.',
                handling:{
                    fInitialDriveForce:[1.0,1.08,1.18,1.30],
                    fTractionLossMult: [1.0,1.05,1.12,1.20]
                }
            },
            inverto:{
                name:'Inverto Sequential Compound', tag:'Race', tagColor:'#c070ff',
                surcharge:1.50, minPIClass:'B', tendency:{ race:3 },
                desc:'Variable geometry race turbo. Zero lag, instant spool, massive peak power.',
                handling:{
                    fInitialDriveForce:[1.0,1.09,1.20,1.34],
                    fDriveInertia:     [1.0,1.06,1.13,1.22]
                }
            }
        },
        sliders:[
            {
                key:'boostPressure', name:'Boost Pressure', icon:'🔴', minStage:1, default:0.5,
                description:'Higher boost = more power but harder on traction and reliability',
                leftLabel:'Low Boost', rightLabel:'Max Boost',
                properties:{
                    fInitialDriveForce:{ min:-0.04, max:0.07 },
                    fTractionLossMult: { min:-0.02, max:0.05 }
                },
                zones:{ safe:[0.20,0.78], caution:[0.10,0.90] },
                styleZones:{ drift:[0.55,0.90], race:[0.40,0.75], drag:[0.65,0.95], offroad:[0.20,0.60], street:[0.25,0.70] },
                warnLow:'Under-boosted — performance barely above stock',
                warnHigh:'Over-boost — serious traction and engine stress risk'
            },
            {
                key:'spoolCharacter', name:'Spool Character', icon:'🌀', minStage:2, default:0.5,
                description:'Trade peak power ceiling for quicker spool response',
                leftLabel:'Fast Spool', rightLabel:'Peak Power',
                properties:{
                    fDriveInertia:     { min:-0.07, max:0.07 },
                    fInitialDriveForce:{ min:0.03,  max:-0.02 }
                },
                zones:{ safe:[0.15,0.82], caution:[0.07,0.92] },
                styleZones:{ drift:[0.10,0.55], race:[0.18,0.62], drag:[0.60,0.90], offroad:[0.12,0.55], street:[0.20,0.65] },
                warnLow:'Extremely fast spool — power surges instantly, unpredictable',
                warnHigh:'Maximum peak boost — huge lag, power arrives very late in rev range'
            }
        ]
    },

    ecu:{
        name:'ECU Tuning', icon:'💻', modType:210, isVirtual:true,
        maxStage:3, group:'power',
        description:['Stock ECU','Stage 1 — Flash tune','Stage 2 — Custom dyno map','Stage 3 — Standalone ECU'],
        variants:{
            vapid:{
                name:'Vapid Safe Remap', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Conservative remap. Safe for everyday use and stock components.',
                handling:{ fInitialDriveForce:[1.0,1.02,1.05,1.09] }
            },
            dinka:{
                name:'Dinka Safe Tune', tag:'Conservative', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Safe, efficient calibration. Optimized for longevity.',
                handling:{ fInitialDriveForce:[1.0,1.03,1.07,1.12] }
            },
            bravado:{
                name:'Bravado Race Flash', tag:'Aggressive', tagColor:'#ff4757',
                surcharge:1.15, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Aggressive timing maps. Maximum power extraction.',
                handling:{
                    fInitialDriveForce:[1.0,1.04,1.09,1.15],
                    fDriveInertia:     [1.0,0.97,0.94,0.90]
                }
            },
            karin:{
                name:'Karin Drift Map', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.10, minPIClass:'D', tendency:{ drift:3 },
                desc:'Torque-heavy low-mid map. Snap throttle, throttle-on oversteer.',
                handling:{
                    fInitialDriveForce:[1.0,1.03,1.08,1.14],
                    fTractionLossMult: [1.0,1.03,1.07,1.12]
                }
            },
            inverto:{
                name:'Inverto Motorsport ECU', tag:'Race', tagColor:'#c070ff',
                surcharge:1.35, minPIClass:'B', tendency:{ race:3 },
                desc:'Full standalone unit. Lap-optimised fuel maps. Razor-sharp throttle response.',
                handling:{
                    fInitialDriveForce:[1.0,1.04,1.10,1.17],
                    fDriveInertia:     [1.0,1.03,1.06,1.10]
                }
            }
        },
        sliders:[]
    },

    exhaust_perf:{
        name:'Exhaust System', icon:'💨', modType:211, isVirtual:true,
        maxStage:3, group:'power',
        description:['Stock Exhaust','Stage 1 — Cat-back system','Stage 2 — Headers + cat-delete','Stage 3 — Full race exhaust'],
        variants:{
            vapid:{
                name:'Vapid Sport Cat-Back', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Legal, quiet, and a solid power bump.',
                handling:{ fInitialDriveForce:[1.0,1.01,1.03,1.06] }
            },
            dinka:{
                name:'Dinka Sport Exhaust', tag:'Balanced', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Optimized back-pressure. Better flow, no drone.',
                handling:{ fInitialDriveForce:[1.0,1.02,1.05,1.09] }
            },
            bravado:{
                name:'Bravado Straight Pipe', tag:'Loud', tagColor:'#ff4757',
                surcharge:1.10, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Zero restriction. Maximum flow and volume.',
                handling:{ fInitialDriveForce:[1.0,1.03,1.07,1.12] }
            },
            karin:{
                name:'Karin Anti-Lag Exhaust', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.15, minPIClass:'D', tendency:{ drift:3 },
                desc:'Popping, crackling, drama. Anti-lag pops built in.',
                handling:{
                    fInitialDriveForce:[1.0,1.03,1.07,1.12],
                    fTractionLossMult: [1.0,1.02,1.04,1.07]
                }
            },
            inverto:{
                name:'Inverto Titanium Race System', tag:'Race', tagColor:'#c070ff',
                surcharge:1.40, minPIClass:'B', tendency:{ race:3 },
                desc:'Lightweight titanium. Maximum scavenging efficiency.',
                handling:{
                    fInitialDriveForce:[1.0,1.04,1.08,1.14],
                    fDriveInertia:     [1.0,0.97,0.94,0.90]
                }
            }
        },
        sliders:[]
    },

    // ────────────────────────────────────────────────────────────────────────
    //  DRIVETRAIN
    // ────────────────────────────────────────────────────────────────────────

    transmission:{
        name:'Transmission', icon:'⚙️', modType:13, isVirtual:false,
        maxStage:4, group:'drivetrain',
        description:[
            'Stock Transmission','Stage 1 — Short-throw shifter',
            'Stage 2 — Close-ratio gearbox','Stage 3 — Sequential gearbox',
            'Stage 4 — Dog-box racing trans'
        ],
        variants:{
            vapid:{
                name:'Vapid Street Gearbox', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Affordable upgrade. Faster shifts, no complexity.',
                handling:{
                    fClutchChangeRateScaleUpShift:  [1.0,1.10,1.22,1.36,1.52],
                    fClutchChangeRateScaleDownShift:[1.0,1.08,1.18,1.30,1.44]
                }
            },
            dinka:{
                name:'Dinka Race Sequential', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Precise, fast shifts. Optimized ratios for circuit racing.',
                handling:{
                    fClutchChangeRateScaleUpShift:  [1.0,1.15,1.30,1.50,1.70],
                    fClutchChangeRateScaleDownShift:[1.0,1.10,1.20,1.35,1.50],
                    fDriveInertia:                  [1.0,0.95,0.90,0.84,0.78]
                }
            },
            bravado:{
                name:'Bravado Close-Ratio', tag:'Power', tagColor:'#ff4757',
                surcharge:1.25, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Ultra-fast shifts, tight gearing. Built for drag.',
                handling:{
                    fClutchChangeRateScaleUpShift:  [1.0,1.20,1.42,1.68,1.95],
                    fClutchChangeRateScaleDownShift:[1.0,1.12,1.25,1.40,1.55],
                    fDriveInertia:                  [1.0,0.97,0.93,0.89,0.85]
                }
            },
            karin:{
                name:'Karin Drift Box', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.15, minPIClass:'D', tendency:{ drift:3 },
                desc:'Spaced ratios for sustained wheelspin. Quick downshift blips.',
                handling:{
                    fClutchChangeRateScaleUpShift:  [1.0,1.10,1.22,1.35,1.50],
                    fClutchChangeRateScaleDownShift:[1.0,1.15,1.32,1.50,1.70],
                    fDriveInertia:                  [1.0,0.93,0.86,0.78,0.70]
                }
            },
            inverto:{
                name:'Inverto Paddleshift Pro', tag:'Race', tagColor:'#c070ff',
                surcharge:1.55, minPIClass:'B', tendency:{ race:3 },
                desc:'Motorsport-grade paddleshift. Shifts in milliseconds. Revs match perfectly on downshifts.',
                handling:{
                    fClutchChangeRateScaleUpShift:  [1.0,1.22,1.46,1.74,2.06],
                    fClutchChangeRateScaleDownShift:[1.0,1.18,1.38,1.62,1.90],
                    fDriveInertia:                  [1.0,1.04,1.09,1.15,1.22]
                }
            }
        },
        sliders:[
            {
                key:'finalDrive', name:'Final Drive Ratio', icon:'⚙', minStage:2, default:0.5,
                description:'Short ratio = explosive acceleration. Long ratio = higher top speed.',
                leftLabel:'Short', rightLabel:'Long',
                properties:{
                    fInitialDriveForce:{ min:0.05, max:-0.05 },
                    fInitialDragCoeff: { min:0.02, max:-0.02 }
                },
                zones:{ safe:[0.18,0.82], caution:[0.08,0.92] },
                styleZones:{ drift:[0.25,0.65], race:[0.35,0.70], drag:[0.10,0.45], offroad:[0.30,0.68], street:[0.30,0.70] },
                warnLow:'Very short gearing — screaming RPM, low top speed',
                warnHigh:'Very long gearing — poor acceleration, struggles from low speed'
            }
        ]
    },

    differential:{
        name:'Differential', icon:'⚡', modType:214, isVirtual:true,
        maxStage:3, group:'drivetrain',
        description:[
            'Stock Open Diff','Stage 1 — Limited-slip differential',
            'Stage 2 — Mechanical LSD','Stage 3 — Active racing differential'
        ],
        variants:{
            vapid:{
                name:'Vapid Budget LSD', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Entry-level LSD. Better than open, simple and reliable.',
                handling:{ fTractionLossMult:[1.0,0.94,0.86,0.76] }
            },
            dinka:{
                name:'Dinka Performance LSD', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Tight lock for corner exit traction. Hooks up hard.',
                handling:{ fTractionLossMult:[1.0,0.90,0.80,0.68] }
            },
            karin:{
                name:'Karin Drift LSD', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.15, minPIClass:'D', tendency:{ drift:3 },
                desc:'Open under braking, locks under power. Promotes oversteer.',
                handling:{
                    fTractionLossMult: [1.0,1.05,1.12,1.22],
                    fTractionBiasFront:[1.0,0.97,0.94,0.90]
                }
            },
            declasse:{
                name:'Declasse Spool Diff', tag:'Drag', tagColor:'#ffaa00',
                surcharge:1.20, minPIClass:'C', tendency:{ drag:3 },
                desc:'Full spool lockup. Both rear wheels spin together. No sideways, all go.',
                handling:{
                    fTractionLossMult: [1.0,0.88,0.76,0.62],
                    fTractionBiasFront:[1.0,0.95,0.90,0.84]
                }
            },
            inverto:{
                name:'Inverto Active Torque Vectoring', tag:'Race', tagColor:'#c070ff',
                surcharge:1.60, minPIClass:'B', tendency:{ race:3 },
                desc:'Electronically-controlled torque vectoring. Rotates car on demand.',
                handling:{
                    fTractionLossMult: [1.0,0.86,0.74,0.60],
                    fTractionBiasFront:[1.0,0.98,0.96,0.94]
                }
            }
        },
        sliders:[
            {
                key:'lockPct', name:'Lock Percentage', icon:'🔒', minStage:1, default:0.5,
                description:'Open diff = less understeer. Locked = maximum traction out of corners.',
                leftLabel:'Open', rightLabel:'Locked',
                properties:{ fTractionLossMult:{ min:0.07, max:-0.09 } },
                zones:{ safe:[0.20,0.80], caution:[0.10,0.90] },
                styleZones:{ drift:[0.05,0.40], race:[0.55,0.85], drag:[0.70,0.95], offroad:[0.45,0.78], street:[0.35,0.72] },
                warnLow:'Near-open diff — inside wheel spins freely, lots of understeer',
                warnHigh:'Full lock — twitchy in corners, oversteer under throttle'
            },
            {
                key:'torqueSplit', name:'Torque Split (AWD)', icon:'↔', minStage:2, default:0.5,
                description:'Front/rear power distribution. Rear = loose and fun. Front = stable.',
                leftLabel:'Rear Bias', rightLabel:'Front Bias',
                properties:{ fTractionBiasFront:{ min:-0.12, max:0.12 } },
                zones:{ safe:[0.25,0.75], caution:[0.12,0.88] },
                styleZones:{ drift:[0.05,0.42], race:[0.42,0.68], drag:[0.08,0.38], offroad:[0.35,0.65], street:[0.38,0.65] },
                warnLow:'Extreme rear bias — easy to spin, fights traction on corner exit',
                warnHigh:'Extreme front bias — severe understeer, no rotation'
            },
            {
                key:'tractionControl', name:'Traction Control', icon:'🛡', minStage:2, default:0.4,
                description:'Full TC = grip at all times. Disabled = raw wheelspin on demand.',
                leftLabel:'Full TC', rightLabel:'TC Off',
                properties:{ fTractionLossMult:{ min:-0.06, max:0.10 } },
                zones:{ safe:[0.15,0.78], caution:[0.08,0.90] },
                styleZones:{ drift:[0.60,0.95], race:[0.10,0.55], drag:[0.50,0.80], offroad:[0.20,0.65], street:[0.12,0.60] },
                warnLow:'Very aggressive TC cuts — chokes power on corner exit',
                warnHigh:'TC fully disabled — any mistake will break traction immediately'
            }
        ]
    },

    // ────────────────────────────────────────────────────────────────────────
    //  HANDLING
    // ────────────────────────────────────────────────────────────────────────

    brakes:{
        name:'Brakes', icon:'🛑', modType:12, isVirtual:false,
        maxStage:4, group:'handling',
        description:[
            'Stock Brakes','Stage 1 — Drilled rotors + pads',
            'Stage 2 — Slotted rotors + SS lines','Stage 3 — Big brake kit, 6-piston',
            'Stage 4 — Carbon ceramic brakes'
        ],
        variants:{
            vapid:{
                name:'Vapid Daily Driver Brakes', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Upgraded street pads and lines. Consistent fade-free daily use.',
                handling:{ fBrakeForce:[1.0,1.06,1.14,1.24,1.36] }
            },
            dinka:{
                name:'Dinka Track Spec', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Consistent, fade-resistant. Perfect for track use.',
                handling:{ fBrakeForce:[1.0,1.10,1.22,1.36,1.52] }
            },
            bravado:{
                name:'Bravado Heavy Duty', tag:'Power', tagColor:'#ff4757',
                surcharge:1.20, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Massive calipers with extreme bite. Heavy but powerful.',
                handling:{ fBrakeForce:[1.0,1.14,1.30,1.48,1.68] }
            },
            inverto:{
                name:'Inverto Mono-Block Race', tag:'Race', tagColor:'#c070ff',
                surcharge:1.55, minPIClass:'B', tendency:{ race:3 },
                desc:'Forged monoblock calipers. Piston-perfect balance at speed.',
                handling:{
                    fBrakeForce:    [1.0,1.16,1.34,1.55,1.78],
                    fBrakeBiasFront:[1.0,1.01,1.02,1.03,1.04]
                }
            },
            pfister:{
                name:'Pfister Carbon Ceramics', tag:'Exotic', tagColor:'#ffd700',
                surcharge:2.00, minPIClass:'A', tendency:{ race:2, drag:1 },
                desc:'Zero fade exotic ceramics. The finest braking money can buy.',
                handling:{
                    fBrakeForce:    [1.0,1.18,1.38,1.62,1.90],
                    fBrakeBiasFront:[1.0,1.01,1.02,1.03,1.05]
                }
            }
        },
        sliders:[
            {
                key:'brakeBias', name:'Brake Bias', icon:'⏹', minStage:1, default:0.55,
                description:'Front bias = stable under braking. Rear bias = easier to rotate the car.',
                leftLabel:'Rear', rightLabel:'Front',
                properties:{ fBrakeBiasFront:{ min:-0.12, max:0.12 } },
                zones:{ safe:[0.35,0.78], caution:[0.18,0.90] },
                styleZones:{ drift:[0.12,0.45], race:[0.50,0.75], drag:[0.60,0.85], offroad:[0.40,0.72], street:[0.42,0.72] },
                warnLow:'Rear brake heavy — car will spin under hard braking',
                warnHigh:'Extreme front bias — understeer on trail-braking'
            },
            {
                key:'brakePressure', name:'Brake Pressure', icon:'🔴', minStage:2, default:0.5,
                description:'Overall brake force. High = shorter stops but risks lock-up.',
                leftLabel:'Light', rightLabel:'Maximum',
                properties:{ fBrakeForce:{ min:-0.06, max:0.10 } },
                zones:{ safe:[0.22,0.76], caution:[0.10,0.88] },
                styleZones:{ drift:[0.15,0.55], race:[0.45,0.78], drag:[0.55,0.82], offroad:[0.30,0.72], street:[0.30,0.70] },
                warnLow:'Very light braking — long stopping distances',
                warnHigh:'Max pressure — wheel lock-up risk, reduces steering under braking'
            }
        ]
    },

    suspension:{
        name:'Suspension', icon:'🔩', modType:15, isVirtual:false,
        maxStage:4, group:'handling',
        description:[
            'Stock Suspension','Stage 1 — Lowering springs',
            'Stage 2 — Sport coilovers','Stage 3 — Race adjustable coilovers',
            'Stage 4 — Competition setup'
        ],
        variants:{
            vapid:{
                name:'Vapid Street Coilover', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Affordable lowering coilover. Comfortable but noticeably stiffer.',
                handling:{
                    fSuspensionForce: [1.0,1.04,1.10,1.17,1.26],
                    fAntiRollBarForce:[1.0,1.03,1.07,1.12,1.18]
                }
            },
            dinka:{
                name:'Dinka Sport', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Stiff, responsive. Flat cornering for maximum grip.',
                handling:{
                    fSuspensionForce: [1.0,1.08,1.18,1.28,1.40],
                    fAntiRollBarForce:[1.0,1.06,1.14,1.22,1.32]
                }
            },
            karin:{
                name:'Karin Drift Spec', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.15, minPIClass:'D', tendency:{ drift:3 },
                desc:'Soft setup for weight transfer. Promotes controlled slides.',
                handling:{
                    fSuspensionForce: [1.0,0.94,0.88,0.82,0.76],
                    fAntiRollBarForce:[1.0,0.92,0.84,0.76,0.68]
                }
            },
            bison:{
                name:'Bison Trail Suspension', tag:'Off-Road', tagColor:'#8b5e3c',
                surcharge:1.20, minPIClass:'D', tendency:{ offroad:3 },
                desc:'Long-travel off-road setup. Absorbs anything the terrain throws.',
                handling:{
                    fSuspensionForce: [1.0,0.90,0.82,0.74,0.66],
                    fAntiRollBarForce:[1.0,0.88,0.78,0.68,0.58],
                    fSuspensionRaise: [1.0,1.04,1.08,1.12,1.16]
                }
            },
            inverto:{
                name:'Inverto Motorsport Coilover', tag:'Race', tagColor:'#c070ff',
                surcharge:1.60, minPIClass:'B', tendency:{ race:3 },
                desc:'Full race geometry. Maximum stiffness, zero roll, full adjustability.',
                handling:{
                    fSuspensionForce: [1.0,1.12,1.26,1.42,1.60],
                    fAntiRollBarForce:[1.0,1.10,1.22,1.36,1.52]
                }
            }
        },
        sliders:[
            {
                key:'stiffness', name:'Spring Rate', icon:'🔩', minStage:1, default:0.5,
                description:'Soft = more grip over bumps. Hard = sharper, flatter direction change.',
                leftLabel:'Soft', rightLabel:'Hard',
                properties:{
                    fSuspensionForce: { min:-0.08, max:0.12 },
                    fAntiRollBarForce:{ min:-0.05, max:0.08 }
                },
                zones:{ safe:[0.18,0.80], caution:[0.08,0.90] },
                styleZones:{ drift:[0.08,0.48], race:[0.55,0.85], drag:[0.45,0.80], offroad:[0.05,0.42], street:[0.25,0.70] },
                warnLow:'Extremely soft — severe body roll, unpredictable weight transfer',
                warnHigh:'Rock-hard spring — chassis skips over bumps, very twitchy'
            },
            {
                key:'rideHeight', name:'Ride Height', icon:'📐', minStage:2, default:0.40,
                description:'Lower = better centre of gravity. Higher = more ground clearance.',
                leftLabel:'Low', rightLabel:'High',
                properties:{ fSuspensionRaise:{ min:-0.08, max:0.08 } },
                zones:{ safe:[0.15,0.82], caution:[0.05,0.92] },
                styleZones:{ drift:[0.10,0.50], race:[0.10,0.45], drag:[0.05,0.38], offroad:[0.55,0.92], street:[0.25,0.65] },
                warnLow:'Slammed — serious bottoming-out risk on any surface imperfection',
                warnHigh:'Very high — raised centre of gravity, increased body roll'
            },
            {
                key:'damping', name:'Damping Rate', icon:'〰', minStage:2, default:0.5,
                description:'Controls how fast suspension compresses and rebounds.',
                leftLabel:'Soft', rightLabel:'Firm',
                properties:{
                    fSuspensionCompDamp:   { min:-0.07, max:0.10 },
                    fSuspensionReboundDamp:{ min:-0.06, max:0.08 }
                },
                zones:{ safe:[0.20,0.78], caution:[0.10,0.90] },
                styleZones:{ drift:[0.10,0.52], race:[0.50,0.82], drag:[0.42,0.78], offroad:[0.08,0.48], street:[0.28,0.68] },
                warnLow:'Under-damped — car bounces continuously, handling very inconsistent',
                warnHigh:'Over-damped — crashes over bumps, shocks can blow'
            }
        ]
    },

    tires:{
        name:'Tires', icon:'🏎️', modType:213, isVirtual:true,
        maxStage:4, group:'handling',
        description:[
            'Stock Tires','Stage 1 — Sport compound',
            'Stage 2 — Semi-slick','Stage 3 — Full slick tires',
            'Stage 4 — Racing slicks, max grip'
        ],
        variants:{
            vapid:{
                name:'Vapid All-Season', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Versatile compound. Works in all conditions, no drama.',
                handling:{
                    fTractionCurveMax:[1.0,1.03,1.07,1.12,1.18],
                    fTractionCurveMin:[1.0,1.03,1.07,1.12,1.18]
                }
            },
            dinka:{
                name:'Dinka Grip Max', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Maximum traction compound. Sticks like glue on tarmac.',
                handling:{
                    fTractionCurveMax:[1.0,1.06,1.14,1.24,1.35],
                    fTractionCurveMin:[1.0,1.05,1.11,1.19,1.28]
                }
            },
            karin:{
                name:'Karin Slide Compound', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.10, minPIClass:'D', tendency:{ drift:3 },
                desc:'Reduced grip for controlled slides. The drifter\'s choice.',
                handling:{
                    fTractionCurveMax:[1.0,0.96,0.92,0.88,0.84],
                    fTractionCurveMin:[1.0,0.94,0.88,0.82,0.76],
                    fTractionLossMult:[1.0,1.08,1.18,1.30,1.44]
                }
            },
            bison:{
                name:'Bison All-Terrain', tag:'Off-Road', tagColor:'#8b5e3c',
                surcharge:1.15, minPIClass:'D', tendency:{ offroad:3 },
                desc:'Aggressive off-road compound. Bites on any surface. Less grip loss on dirt/gravel.',
                handling:{
                    fTractionCurveMax:[1.0,1.04,1.09,1.15,1.22],
                    fTractionCurveMin:[1.0,1.06,1.13,1.21,1.30],
                    fTractionLossMult:[1.0,0.92,0.84,0.76,0.68]
                }
            },
            declasse:{
                name:'Declasse Drag Slick', tag:'Drag', tagColor:'#ffaa00',
                surcharge:1.20, minPIClass:'C', tendency:{ drag:3 },
                desc:'Bias-ply drag slicks. Unreal straight-line bite, hopeless in corners.',
                handling:{
                    fTractionCurveMax:[1.0,1.01,1.03,1.06,1.10],
                    fTractionCurveMin:[1.0,1.12,1.26,1.42,1.60]
                }
            }
        },
        sliders:[
            {
                key:'tirePressure', name:'Tire Pressure', icon:'🎈', minStage:1, default:0.5,
                description:'Low pressure = more contact patch grip. High = less grip, less drag.',
                leftLabel:'Low PSI', rightLabel:'High PSI',
                properties:{
                    fTractionCurveMax:{ min:0.05, max:-0.05 },
                    fInitialDragCoeff:{ min:0.02, max:-0.02 }
                },
                zones:{ safe:[0.20,0.80], caution:[0.10,0.90] },
                styleZones:{ drift:[0.30,0.65], race:[0.18,0.58], drag:[0.10,0.42], offroad:[0.12,0.50], street:[0.25,0.68] },
                warnLow:'Dangerously low pressure — tire can deform or unseat at speed',
                warnHigh:'Over-inflated — tiny contact patch, snap handling changes'
            }
        ]
    },

    // ────────────────────────────────────────────────────────────────────────
    //  CHASSIS
    // ────────────────────────────────────────────────────────────────────────

    rollcage:{
        name:'Roll Cage', icon:'🛡️', modType:215, isVirtual:true,
        maxStage:2, group:'chassis',
        description:['No Roll Cage','Stage 1 — Half cage, improved rigidity','Stage 2 — Full cage, maximum rigidity'],
        variants:{
            standard:{
                name:'Standard Chromoly Cage', tag:'Universal', tagColor:'#8a8fa6',
                surcharge:1.0, minPIClass:'F', tendency:{ race:1, street:1 },
                desc:'Chromoly steel cage. Ties chassis together — reduces flex and body roll.',
                handling:{
                    fRollCentreHeightFront:[1.0,1.12,1.26],
                    fRollCentreHeightRear: [1.0,1.12,1.26],
                    fAntiRollBarForce:     [1.0,1.08,1.18]
                }
            },
            bravado:{
                name:'Bravado Street Cage', tag:'Power', tagColor:'#ff4757',
                surcharge:1.10, minPIClass:'F', tendency:{ drag:1, street:2 },
                desc:'Practical roll cage. Stiffens the chassis without full race-spec complexity.',
                handling:{
                    fRollCentreHeightFront:[1.0,1.10,1.22],
                    fRollCentreHeightRear: [1.0,1.10,1.22],
                    fAntiRollBarForce:     [1.0,1.06,1.14]
                }
            },
            inverto:{
                name:'Inverto FIA Race Cage', tag:'Race', tagColor:'#c070ff',
                surcharge:1.45, minPIClass:'B', tendency:{ race:3 },
                desc:'Full FIA-spec cage. Chassis is essentially a rigid unit. Flat, planted, precise.',
                handling:{
                    fRollCentreHeightFront:[1.0,1.18,1.38],
                    fRollCentreHeightRear: [1.0,1.18,1.38],
                    fAntiRollBarForce:     [1.0,1.12,1.26]
                }
            }
        },
        sliders:[]
    },

    weight:{
        name:'Weight Reduction', icon:'🪶', modType:216, isVirtual:true,
        maxStage:4, group:'chassis',
        description:[
            'Stock Weight','Stage 1 — Lightweight battery & wheels',
            'Stage 2 — Carbon panels, stripped rear','Stage 3 — Gutted interior, lexan windows',
            'Stage 4 — Full carbon shell'
        ],
        variants:{
            vapid:{
                name:'Vapid Budget Strip', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.80, minPIClass:'F', tendency:{ street:3 },
                desc:'Remove what you don\'t need. Cheap and effective.',
                handling:{ fMass:[1.0,0.97,0.93,0.88,0.82], fInitialDragCoeff:[1.0,0.99,0.97,0.95,0.92] }
            },
            dinka:{
                name:'Dinka Balanced Strip', tag:'Balanced', tagColor:'#00a8ff',
                surcharge:1.0, minPIClass:'F', tendency:{ race:2, street:1 },
                desc:'Strategic weight savings while maintaining balance.',
                handling:{ fMass:[1.0,0.96,0.91,0.85,0.78], fInitialDragCoeff:[1.0,0.98,0.95,0.92,0.88] }
            },
            bravado:{
                name:'Bravado Extreme Strip', tag:'Aggressive', tagColor:'#ff4757',
                surcharge:1.30, minPIClass:'F', tendency:{ drag:2, street:1 },
                desc:'Ruthless weight reduction. Strip everything non-essential.',
                handling:{ fMass:[1.0,0.94,0.87,0.79,0.70], fInitialDragCoeff:[1.0,0.97,0.93,0.88,0.82] }
            },
            inverto:{
                name:'Inverto Full Carbon Programme', tag:'Race', tagColor:'#c070ff',
                surcharge:1.80, minPIClass:'B', tendency:{ race:3 },
                desc:'Complete carbon fibre replacement. The ultimate weight loss.',
                handling:{ fMass:[1.0,0.93,0.85,0.76,0.66], fInitialDragCoeff:[1.0,0.97,0.93,0.88,0.82] }
            }
        },
        sliders:[]
    },

    // ────────────────────────────────────────────────────────────────────────
    //  STYLE-EXCLUSIVE CATEGORIES
    //  Shown to all players, locked until style threshold is met.
    // ────────────────────────────────────────────────────────────────────────

    hydraulicHandbrake:{
        name:'Hydraulic Handbrake', icon:'🅿️', modType:217, isVirtual:true,
        maxStage:3, group:'exclusive', styleRequired:'drift',
        description:['Stock Handbrake','Stage 1 — Hydraulic line conversion','Stage 2 — Remote reservoir + bias valve','Stage 3 — Race-spec dual-circuit hydro'],
        variants:{
            standard:{
                name:'Standard Hydro Conversion', tag:'OEM', tagColor:'#8a8fa6',
                surcharge:0.85, minPIClass:'F', tendency:{ drift:2, street:1 },
                desc:'Basic hydraulic conversion kit. Better than cable, no frills.',
                handling:{ fHandBrakeForce:[1.0,1.20,1.48,1.82] }
            },
            karin:{
                name:'Karin Drift Hydro', tag:'Drift', tagColor:'#ff6b35',
                surcharge:1.0, minPIClass:'D', tendency:{ drift:3 },
                desc:'Immediate, sharp handbrake. Purpose-built for initiating drifts.',
                handling:{ fHandBrakeForce:[1.0,1.30,1.65,2.10], fBrakeBiasFront:[1.0,0.96,0.92,0.87] }
            },
            inverto:{
                name:'Inverto Competition Hydro', tag:'Race', tagColor:'#c070ff',
                surcharge:1.40, minPIClass:'B', tendency:{ drift:2, race:1 },
                desc:'Adjustable bias valve. Precise rear lock control at any speed.',
                handling:{ fHandBrakeForce:[1.0,1.35,1.75,2.25], fBrakeBiasFront:[1.0,0.94,0.88,0.82] }
            }
        },
        sliders:[
            {
                key:'lockPressure', name:'Lock Pressure', icon:'🅿️', minStage:1, default:0.6,
                description:'Controls how aggressively the handbrake locks the rear wheels.',
                leftLabel:'Soft', rightLabel:'Instant',
                properties:{ fHandBrakeForce:{ min:-0.10, max:0.20 }, fBrakeBiasFront:{ min:0.02, max:-0.06 } },
                zones:{ safe:[0.25,0.82], caution:[0.12,0.92] },
                styleZones:{ drift:[0.55,0.92], race:[0.40,0.75], drag:[0.30,0.65], offroad:[0.25,0.65], street:[0.30,0.68] },
                warnLow:'Too soft — handbrake barely affects rear traction',
                warnHigh:'Instant lock — car will snap hard, requires precise technique'
            }
        ]
    },

    launchControl:{
        name:'Launch Control', icon:'🚀', modType:218, isVirtual:true,
        maxStage:3, group:'exclusive', styleRequired:'drag',
        description:['No Launch Control','Stage 1 — Basic rev-limiter launch','Stage 2 — Traction-managed 2-step','Stage 3 — Full anti-lag launch system'],
        variants:{
            bravado:{
                name:'Bravado Launch Package', tag:'Power', tagColor:'#ff4757',
                surcharge:1.0, minPIClass:'F', tendency:{ drag:3 },
                desc:'Flat-foot launch with built-in burnout management.',
                handling:{ fInitialDriveForce:[1.0,1.04,1.10,1.18], fTractionCurveMin:[1.0,1.05,1.12,1.20] }
            },
            declasse:{
                name:'Declasse Strip Launch', tag:'Drag', tagColor:'#ffaa00',
                surcharge:1.25, minPIClass:'C', tendency:{ drag:3 },
                desc:'Drag strip optimised launch software. Perfect 60-ft times.',
                handling:{ fInitialDriveForce:[1.0,1.06,1.13,1.22], fTractionCurveMin:[1.0,1.08,1.18,1.30], fTractionBiasFront:[1.0,0.96,0.92,0.87] }
            },
            inverto:{
                name:'Inverto Motorsport 2-Step', tag:'Race', tagColor:'#c070ff',
                surcharge:1.60, minPIClass:'B', tendency:{ drag:2, race:1 },
                desc:'Precision 2-step with anti-lag. Builds boost while holding the line.',
                handling:{ fInitialDriveForce:[1.0,1.07,1.15,1.25], fTractionCurveMin:[1.0,1.08,1.18,1.30], fDriveInertia:[1.0,0.94,0.88,0.82] }
            }
        },
        sliders:[
            {
                key:'launchRPM', name:'Launch RPM', icon:'🚀', minStage:1, default:0.55,
                description:'Target RPM held on the 2-step. Higher = more boost off the line, harder on drivetrain.',
                leftLabel:'Low RPM', rightLabel:'Max RPM',
                properties:{ fInitialDriveForce:{ min:-0.03, max:0.08 }, fTractionCurveMin:{ min:-0.02, max:0.06 }, fLowSpeedTractionLossMult:{ min:0.04, max:-0.10 } },
                zones:{ safe:[0.20,0.80], caution:[0.10,0.92] },
                styleZones:{ drift:[0.30,0.65], race:[0.35,0.70], drag:[0.60,0.92], offroad:[0.20,0.58], street:[0.28,0.68] },
                warnLow:'Low launch RPM — slow off the line, boost not ready',
                warnHigh:'Extreme launch RPM — massive drivetrain stress, tire smoke guaranteed'
            },
            {
                key:'tractionMgmt', name:'Traction Management', icon:'🛞', minStage:2, default:0.5,
                description:'How aggressively TC cuts power during launch. Full = clean hook-up. Off = raw wheelspin.',
                leftLabel:'Full TC', rightLabel:'Raw Launch',
                properties:{ fLowSpeedTractionLossMult:{ min:-0.08, max:0.18 } },
                zones:{ safe:[0.20,0.78], caution:[0.10,0.90] },
                styleZones:{ drift:[0.60,0.95], race:[0.15,0.55], drag:[0.55,0.88], offroad:[0.20,0.65], street:[0.15,0.60] },
                warnLow:'Aggressive TC cuts — power strangled at launch start',
                warnHigh:'Full wheelspin — depends entirely on driver skill to hook up'
            }
        ]
    },

    liftKit:{
        name:'Lift Kit', icon:'⬆️', modType:219, isVirtual:true,
        maxStage:3, group:'exclusive', styleRequired:'offroad', vehicleTypeRequired:true,
        description:['Stock Ride Height','Stage 1 — +2" lift, spacer lift','Stage 2 — +4" lift, full body lift','Stage 3 — +6" long-travel custom lift'],
        variants:{
            standard:{
                name:'Standard Body Lift', tag:'OEM', tagColor:'#8a8fa6',
                surcharge:0.85, minPIClass:'F', tendency:{ offroad:2, street:1 },
                desc:'Budget body lift kit. Gets the clearance without breaking the bank.',
                handling:{ fSuspensionRaise:[1.0,1.04,1.08,1.12], fSuspensionForce:[1.0,0.95,0.90,0.85] }
            },
            bison:{
                name:'Bison Trail Lift', tag:'Off-Road', tagColor:'#8b5e3c',
                surcharge:1.0, minPIClass:'D', tendency:{ offroad:3 },
                desc:'Purpose-built trail lift. Extended travel, protected geometry.',
                handling:{ fSuspensionRaise:[1.0,1.06,1.12,1.18], fSuspensionForce:[1.0,0.92,0.84,0.76], fAntiRollBarForce:[1.0,0.90,0.80,0.70] }
            },
            inverto:{
                name:'Inverto Long-Travel Race Lift', tag:'Race', tagColor:'#c070ff',
                surcharge:1.70, minPIClass:'B', tendency:{ offroad:2, race:1 },
                desc:'Rally-bred long-travel system. Fly over rough terrain without losing speed.',
                handling:{ fSuspensionRaise:[1.0,1.08,1.14,1.20], fSuspensionForce:[1.0,0.88,0.78,0.68], fAntiRollBarForce:[1.0,0.86,0.74,0.62] }
            }
        },
        sliders:[
            {
                key:'liftHeight', name:'Lift Height', icon:'⬆️', minStage:1, default:0.5,
                description:'Dial in exact height. Higher clears obstacles; lower is more stable.',
                leftLabel:'Min', rightLabel:'Max',
                properties:{ fSuspensionRaise:{ min:0.02, max:0.14 } },
                zones:{ safe:[0.15,0.82], caution:[0.05,0.92] },
                styleZones:{ drift:[0.10,0.45], race:[0.10,0.50], drag:[0.05,0.35], offroad:[0.55,0.92], street:[0.20,0.60] },
                warnLow:'Very low lift — minimal clearance improvement over stock',
                warnHigh:'Maximum lift — very high centre of gravity, severe stability risk'
            },
            {
                key:'suspTravel', name:'Suspension Travel', icon:'〰', minStage:2, default:0.6,
                description:'More travel absorbs bigger impacts. Less keeps the car flatter.',
                leftLabel:'Firm', rightLabel:'Flexy',
                properties:{ fSuspensionForce:{ min:0.08, max:-0.10 }, fAntiRollBarForce:{ min:0.06, max:-0.08 } },
                zones:{ safe:[0.22,0.85], caution:[0.10,0.94] },
                styleZones:{ drift:[0.20,0.60], race:[0.40,0.75], drag:[0.38,0.72], offroad:[0.58,0.92], street:[0.28,0.70] },
                warnLow:'Very stiff off-road setup — loses traction over rough terrain',
                warnHigh:'Extreme flex — rolls dangerously on-road, unstable at speed'
            }
        ]
    },

    activeAero:{
        name:'Active Aero', icon:'🪁', modType:220, isVirtual:true,
        maxStage:3, group:'exclusive', styleRequired:'race', minPIClass:'A',
        description:['No Aero Package','Stage 1 — Fixed splitter & spoiler','Stage 2 — Adjustable wing & diffuser','Stage 3 — Full active aero system'],
        variants:{
            dinka:{
                name:'Dinka Balanced Aero', tag:'Grip', tagColor:'#00a8ff',
                surcharge:1.30, minPIClass:'A', tendency:{ race:2, street:1 },
                desc:'Conservative aerodynamic package. Clean, efficient, predictable.',
                handling:{ fTractionCurveMax:[1.0,1.04,1.09,1.15], fInitialDragCoeff:[1.0,1.02,1.05,1.09] }
            },
            inverto:{
                name:'Inverto Race Aero', tag:'Race', tagColor:'#c070ff',
                surcharge:1.0, minPIClass:'A', tendency:{ race:3 },
                desc:'Precision aerodynamics. Maximum downforce balanced with drag management.',
                handling:{ fTractionCurveMax:[1.0,1.05,1.12,1.20], fInitialDragCoeff:[1.0,1.03,1.07,1.12] }
            },
            pfister:{
                name:'Pfister Exotic Active Aero', tag:'Exotic', tagColor:'#ffd700',
                surcharge:1.80, minPIClass:'A', tendency:{ race:2, drag:1 },
                desc:'Active wing deployment. Drag-reducing on straights, full downforce in corners.',
                handling:{ fTractionCurveMax:[1.0,1.07,1.16,1.26], fInitialDragCoeff:[1.0,1.02,1.04,1.07] }
            }
        },
        sliders:[
            {
                key:'downforce', name:'Downforce Level', icon:'⬇', minStage:1, default:0.55,
                description:'More downforce = more high-speed grip at cost of straight-line speed.',
                leftLabel:'Low Drag', rightLabel:'Max Down',
                properties:{ fTractionCurveMax:{ min:-0.04, max:0.08 }, fInitialDragCoeff:{ min:-0.03, max:0.07 } },
                zones:{ safe:[0.18,0.82], caution:[0.08,0.92] },
                styleZones:{ drift:[0.10,0.50], race:[0.55,0.88], drag:[0.05,0.38], offroad:[0.20,0.60], street:[0.30,0.68] },
                warnLow:'Minimal downforce — fast in a straight, floaty in corners at speed',
                warnHigh:'Maximum downforce — top speed severely limited by drag'
            }
        ]
    },

    streetKit:{
        name:'Street Essentials', icon:'🏙', modType:221, isVirtual:true,
        maxStage:3, group:'exclusive',
        description:['No Street Kit','Stage 1 — Economy tune, balanced gains','Stage 2 — Sport pack, all areas improved','Stage 3 — Street Performance pack'],
        variants:{
            standard:{
                name:'OEM+ Refresh', tag:'OEM', tagColor:'#8a8fa6',
                surcharge:0.65, minPIClass:'F', tendency:{ street:2, race:1 },
                desc:'Genuine parts upgrade. Stock-feeling but sharper.',
                handling:{ fInitialDriveForce:[1.0,1.02,1.05,1.09], fBrakeForce:[1.0,1.02,1.05,1.09] }
            },
            vapid:{
                name:'Vapid All-Rounder', tag:'Street', tagColor:'#8aaa30',
                surcharge:0.70, minPIClass:'F', tendency:{ street:3 },
                desc:'Does a little of everything. Cost-effective and unpretentious.',
                handling:{
                    fInitialDriveForce:[1.0,1.03,1.07,1.12],
                    fTractionCurveMax: [1.0,1.02,1.04,1.07],
                    fBrakeForce:       [1.0,1.03,1.06,1.10]
                }
            }
        },
        sliders:[]
    }
};

// ─── Group labels & display order ────────────────────────────────────────────
const PERF_GROUP_LABELS = {
    power:     'Power',
    drivetrain:'Drivetrain',
    handling:  'Handling',
    chassis:   'Chassis',
    exclusive: 'Style Exclusive'
};
const PERF_GROUP_ORDER = ['power','drivetrain','handling','chassis','exclusive'];

// ═══════════════════════════════════════════════════════════════════════════════
// PI CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const PI_CONFIG = {
    basePi:{ F:100, E:175, D:260, C:370, B:500, A:650, S:820 },
    classThresholds:[
        { min:0,   max:150, label:'F', color:'#555555' },
        { min:151, max:275, label:'E', color:'#8a8fa6' },
        { min:276, max:400, label:'D', color:'#00a8ff' },
        { min:401, max:550, label:'C', color:'#2ecc71' },
        { min:551, max:700, label:'B', color:'#f39c12' },
        { min:701, max:850, label:'A', color:'#ff6b35' },
        { min:851, max:999, label:'S', color:'#ff4757' }
    ],
    piPerStage:{
        engine:            [8,12,18,24,32],
        turbo:             [14,22,32],
        ecu:               [3,6,10],
        exhaust_perf:      [2,4,7],
        transmission:      [5,8,12,16],
        differential:      [4,6,10],
        brakes:            [4,7,10,14],
        suspension:        [4,7,10,14],
        tires:             [6,10,14,20],
        rollcage:          [3,6],
        weight:            [5,8,12,18],
        hydraulicHandbrake:[5,8,12],
        launchControl:     [6,10,15],
        liftKit:           [4,7,10],
        activeAero:        [9,15,22],
        streetKit:         [2,5,8]
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// COST FORMULA
// ═══════════════════════════════════════════════════════════════════════════════
const PERF_COST_FORMULA = {
    categories:{
        engine:            { baseMoney:2000, baseParts:3, partsPerStage:1, maxParts:8 },
        turbo:             { baseMoney:5000, baseParts:5, partsPerStage:1, maxParts:8 },
        ecu:               { baseMoney:2500, baseParts:3, partsPerStage:1, maxParts:6 },
        exhaust_perf:      { baseMoney:1800, baseParts:3, partsPerStage:1, maxParts:6 },
        transmission:      { baseMoney:1500, baseParts:3, partsPerStage:1, maxParts:7 },
        differential:      { baseMoney:2000, baseParts:3, partsPerStage:1, maxParts:6 },
        brakes:            { baseMoney:1200, baseParts:2, partsPerStage:1, maxParts:6 },
        suspension:        { baseMoney:1000, baseParts:2, partsPerStage:1, maxParts:6 },
        tires:             { baseMoney:1000, baseParts:2, partsPerStage:1, maxParts:6 },
        rollcage:          { baseMoney:3000, baseParts:4, partsPerStage:2, maxParts:8 },
        weight:            { baseMoney:3500, baseParts:3, partsPerStage:2, maxParts:8 },
        hydraulicHandbrake:{ baseMoney:2500, baseParts:3, partsPerStage:1, maxParts:7 },
        launchControl:     { baseMoney:3000, baseParts:3, partsPerStage:1, maxParts:7 },
        liftKit:           { baseMoney:2000, baseParts:3, partsPerStage:1, maxParts:6 },
        activeAero:        { baseMoney:6000, baseParts:5, partsPerStage:2, maxParts:10 },
        streetKit:         { baseMoney:800,  baseParts:2, partsPerStage:1, maxParts:5 }
    },
    gradeScale: { F:0.7, E:1.0, D:1.4, C:2.0, B:3.0, A:4.5, S:7.0 },
    stageScale: [1.0,1.8,3.2,5.5,9.0],
    gradeIndex: { F:0, E:1, D:2, C:3, B:4, A:5, S:6 },
    rarityByTier:[
        'common','common','uncommon','uncommon','rare',
        'rare','epic','epic','legendary','legendary','legendary','legendary'
    ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function isPIClassAtLeast(vehicleClass, minClass) {
    return PI_CLASS_ORDER.indexOf(vehicleClass) >= PI_CLASS_ORDER.indexOf(minClass);
}

function getEffectiveMaxStage(catKey, piClass) {
    const mod = PERFORMANCE_MODS[catKey];
    if (!mod) return 0;
    return Math.min(mod.maxStage, PI_CLASS_STAGE_CAPS[piClass] || 5);
}

function getAvailableVariants(catKey, piClass) {
    const mod = PERFORMANCE_MODS[catKey];
    if (!mod) return {};
    const result = {};
    for (const [vk, v] of Object.entries(mod.variants || {})) {
        if (!v.minPIClass || isPIClassAtLeast(piClass, v.minPIClass)) {
            result[vk] = {
                name:v.name, tag:v.tag, tagColor:v.tagColor,
                surcharge:v.surcharge, tendency:v.tendency, desc:v.desc,
                minPIClass: v.minPIClass || 'F'
            };
        }
    }
    return result;
}

function getCategoryLockState(catKey, piClass, vehicleType, buildTendency) {
    const mod = PERFORMANCE_MODS[catKey];
    if (!mod) return { locked:true, reason:'Unknown category' };

    if (mod.minPIClass && !isPIClassAtLeast(piClass, mod.minPIClass)) {
        return { locked:true, reason:`Requires ${mod.minPIClass}-class vehicle or higher` };
    }
    if (mod.vehicleTypeRequired) {
        const vt = (vehicleType || '').toLowerCase();
        if (!OFFROAD_VEHICLE_TYPES.has(vt)) {
            return { locked:true, reason:'Requires SUV, Truck, or Off-Road vehicle' };
        }
    }
    if (mod.styleRequired && buildTendency) {
        const styleScore = buildTendency.scores[mod.styleRequired] || 0;
        const total = Object.values(buildTendency.scores).reduce((a,b)=>a+b,0);
        const pct = total > 0 ? styleScore / total : 0;
        if (pct < STYLE_UNLOCK_THRESHOLD) {
            const styleName = BUILD_STYLES[mod.styleRequired] ? BUILD_STYLES[mod.styleRequired].name : mod.styleRequired;
            const needed = Math.round(STYLE_UNLOCK_THRESHOLD * 100);
            const has    = Math.round(pct * 100);
            return {
                locked:true,
                reason:`Requires ${needed}% ${styleName} build (you have ${has}%)`,
                styleRequired:mod.styleRequired, stylePercent:has, styleNeeded:needed
            };
        }
    }
    return { locked:false, reason:null };
}

function _applySafetyCaps(combined) {
    for (const [prop, caps] of Object.entries(HANDLING_SAFETY_CAPS)) {
        if (combined[prop] === undefined) continue;
        if (caps.min !== undefined) combined[prop] = Math.max(caps.min, combined[prop]);
        if (caps.max !== undefined) combined[prop] = Math.min(caps.max, combined[prop]);
    }
}

function calcAllHandling(stages, variants, sliderData, piClass) {
    const rangeScale = PI_SLIDER_RANGE_SCALE[piClass || 'E'] || 1.0;
    const combined   = {};

    for (const [catKey, mod] of Object.entries(PERFORMANCE_MODS)) {
        const stage = stages[catKey] || 0;
        if (stage === 0) continue;
        const vKeys   = Object.keys(mod.variants || {});
        const vk      = (variants && variants[catKey]) || vKeys[0];
        const variant = (mod.variants || {})[vk];
        if (!variant || !variant.handling) continue;

        for (const [prop, curve] of Object.entries(variant.handling)) {
            const idx = Math.min(stage, curve.length - 1);
            combined[prop] = (combined[prop] || 1.0) * (curve[idx] || 1.0);
        }

        const cs = (sliderData && sliderData[catKey]) || {};
        for (const sl of (mod.sliders || [])) {
            if (stage < sl.minStage) continue;
            const val     = cs[sl.key] !== undefined ? cs[sl.key] : sl.default;
            const clamped = Math.max(0, Math.min(1, val));
            for (const [prop, range] of Object.entries(sl.properties)) {
                const sMin = range.min * rangeScale;
                const sMax = range.max * rangeScale;
                const off  = sMin + (sMax - sMin) * clamped;
                combined[prop] = (combined[prop] || 1.0) * (1.0 + off);
            }
        }
    }

    _applySafetyCaps(combined);

    // Drift mode override
    const tendency = calcBuildTendency(variants, stages);
    if (tendency.isDriftMode) {
        for (const [prop, driftMult] of Object.entries(DRIFT_MODE_HANDLING)) {
            combined[prop] = (combined[prop] || 1.0) * driftMult;
        }
        _applySafetyCaps(combined);
    }

    return combined;
}

function calcBuildTendency(variants, stages) {
    const scores = { drift:0, race:0, drag:0, offroad:0, street:0 };
    if (!variants) return { scores, dominant:'balanced', percentage:0, isDriftMode:false, grip:0, power:0, drift:0 };

    for (const [ck, vk] of Object.entries(variants)) {
        if (!stages || !stages[ck] || stages[ck] === 0) continue;
        const mod = PERFORMANCE_MODS[ck];
        if (!mod) continue;
        const v = (mod.variants || {})[vk];
        if (!v || !v.tendency) continue;
        for (const [style, pts] of Object.entries(v.tendency)) {
            if (scores[style] !== undefined) scores[style] += (pts || 0);
        }
    }

    const total = Object.values(scores).reduce((a,b) => a+b, 0);
    if (total === 0) return { scores, dominant:'balanced', percentage:0, isDriftMode:false, grip:0, power:0, drift:0 };

    let dominant = 'balanced', maxScore = 0;
    for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; dominant = style; }
    }
    if (Object.values(scores).filter(v => v === maxScore).length > 1) dominant = 'balanced';

    const percentage  = Math.round((maxScore / total) * 100);
    const isDriftMode = dominant === 'drift' && (maxScore / total) >= DRIFT_MODE_THRESHOLD;

    return {
        scores, dominant, percentage, isDriftMode,
        grip: scores.race, power: scores.drag, drift: scores.drift
    };
}

function calcDriftModeActive(variants, stages) {
    return calcBuildTendency(variants, stages).isDriftMode;
}

// Per-category upgrade item requirements (independent of vehicle grade)
// Stage index = stage - 1.  Items are the real named car components.
const STAGE_ITEMS_DATA = {
    engine: [
        [{itemId:'piston_common',count:4}, {itemId:'engine_block_common',count:1}],
        [{itemId:'crankshaft_uncommon',count:1}, {itemId:'piston_uncommon',count:4}, {itemId:'engine_block_rare',count:1}],
        [{itemId:'crankshaft_rare',count:1}, {itemId:'piston_rare',count:2}, {itemId:'engine_block_rare',count:1}],
        [{itemId:'crankshaft_epic',count:1}, {itemId:'engine_block_epic',count:1}, {itemId:'piston_epic',count:2}],
        [{itemId:'crankshaft_legendary',count:1}, {itemId:'engine_block_legendary',count:1}],
    ],
    turbo: [
        [{itemId:'turbo_manifold_common',count:2}, {itemId:'wastegate_common',count:1}],
        [{itemId:'intercooler_uncommon',count:1}, {itemId:'turbo_manifold_uncommon',count:2}, {itemId:'wastegate_uncommon',count:1}],
        [{itemId:'intercooler_rare',count:1}, {itemId:'turbo_manifold_rare',count:2}, {itemId:'wastegate_rare',count:1}],
    ],
    ecu: [
        [{itemId:'ecu_chip_common',count:2}, {itemId:'fuel_injector_common',count:2}],
        [{itemId:'ecu_chip_uncommon',count:1}, {itemId:'fuel_injector_uncommon',count:3}],
        [{itemId:'ecu_chip_rare',count:1}, {itemId:'fuel_injector_rare',count:2}],
    ],
    exhaust_perf: [
        [{itemId:'exhaust_manifold_common',count:2}],
        [{itemId:'exhaust_header_uncommon',count:1}, {itemId:'exhaust_manifold_uncommon',count:2}],
        [{itemId:'exhaust_header_rare',count:1}, {itemId:'exhaust_manifold_rare',count:1}],
    ],
    transmission: [
        [{itemId:'clutch_kit_common',count:2}],
        [{itemId:'gear_set_uncommon',count:1}, {itemId:'clutch_kit_uncommon',count:2}],
        [{itemId:'gear_set_rare',count:1}, {itemId:'clutch_kit_rare',count:1}],
        [{itemId:'gear_set_epic',count:1}, {itemId:'clutch_kit_epic',count:1}],
    ],
    differential: [
        [{itemId:'lsd_pack_common',count:2}],
        [{itemId:'ring_pinion_uncommon',count:1}, {itemId:'lsd_pack_uncommon',count:2}],
        [{itemId:'ring_pinion_rare',count:1}, {itemId:'lsd_pack_rare',count:1}],
    ],
    brakes: [
        [{itemId:'brake_pad_common',count:4}, {itemId:'brake_rotor_common',count:1}],
        [{itemId:'brake_rotor_uncommon',count:1}, {itemId:'brake_pad_uncommon',count:4}, {itemId:'brake_caliper_uncommon',count:1}],
        [{itemId:'brake_rotor_rare',count:1}, {itemId:'brake_caliper_rare',count:1}, {itemId:'brake_pad_rare',count:2}],
        [{itemId:'brake_rotor_epic',count:1}, {itemId:'brake_caliper_epic',count:1}],
    ],
    suspension: [
        [{itemId:'coilover_spring_common',count:2}, {itemId:'shock_absorber_common',count:1}],
        [{itemId:'coilover_spring_uncommon',count:2}, {itemId:'shock_absorber_uncommon',count:2}, {itemId:'sway_bar_uncommon',count:1}],
        [{itemId:'coilover_spring_rare',count:1}, {itemId:'shock_absorber_rare',count:2}, {itemId:'sway_bar_rare',count:1}],
        [{itemId:'coilover_spring_epic',count:1}, {itemId:'shock_absorber_epic',count:1}, {itemId:'sway_bar_epic',count:1}],
    ],
    tires: [
        [{itemId:'tire_compound_common',count:4}],
        [{itemId:'tire_compound_uncommon',count:3}, {itemId:'wheel_bearing_uncommon',count:2}],
        [{itemId:'tire_compound_rare',count:2}, {itemId:'wheel_bearing_rare',count:1}],
        [{itemId:'tire_compound_epic',count:2}],
    ],
    rollcage: [
        [{itemId:'chromoly_tube_common',count:4}],
        [{itemId:'chromoly_tube_uncommon',count:4}, {itemId:'gusset_plate_uncommon',count:2}],
    ],
    weight: [
        [{itemId:'aluminum_hardware_common',count:4}],
        [{itemId:'carbon_panel_uncommon',count:2}, {itemId:'aluminum_hardware_uncommon',count:2}],
        [{itemId:'carbon_panel_rare',count:2}, {itemId:'aluminum_hardware_rare',count:1}],
        [{itemId:'carbon_panel_epic',count:2}],
    ],
    hydraulicHandbrake: [
        [{itemId:'hydraulic_cylinder_common',count:2}, {itemId:'bias_valve_common',count:1}],
        [{itemId:'hydraulic_cylinder_uncommon',count:1}, {itemId:'bias_valve_uncommon',count:2}],
        [{itemId:'hydraulic_cylinder_rare',count:1}, {itemId:'bias_valve_rare',count:1}],
    ],
    launchControl: [
        [{itemId:'launch_module_common',count:2}, {itemId:'rev_limiter_common',count:1}],
        [{itemId:'launch_module_uncommon',count:1}, {itemId:'rev_limiter_uncommon',count:2}],
        [{itemId:'launch_module_rare',count:1}, {itemId:'rev_limiter_rare',count:1}],
    ],
    liftKit: [
        [{itemId:'lift_spacer_common',count:4}],
        [{itemId:'lift_spacer_uncommon',count:2}, {itemId:'extended_shock_uncommon',count:2}],
        [{itemId:'extended_shock_rare',count:2}, {itemId:'lift_spacer_rare',count:1}],
    ],
    activeAero: [
        [{itemId:'carbon_wing_uncommon',count:1}, {itemId:'actuator_motor_uncommon',count:2}],
        [{itemId:'carbon_wing_rare',count:2}, {itemId:'actuator_motor_rare',count:1}],
        [{itemId:'carbon_wing_epic',count:2}, {itemId:'actuator_motor_epic',count:1}],
    ],
    streetKit: [
        [{itemId:'tune_kit_common',count:2}],
        [{itemId:'tune_kit_uncommon',count:1}, {itemId:'sport_spring_uncommon',count:2}],
        [{itemId:'tune_kit_rare',count:1}, {itemId:'sport_spring_rare',count:1}],
    ],
};

function calcUpgradeReq(catKey, grade, stage, variantKey) {
    const cat = PERF_COST_FORMULA.categories[catKey];
    if (!cat) return null;
    const mod = PERFORMANCE_MODS[catKey];
    if (!mod || stage < 1 || stage > mod.maxStage) return null;

    const gs = PERF_COST_FORMULA.gradeScale[grade] || 1.0;
    const ss = PERF_COST_FORMULA.stageScale[stage - 1] || 1.0;
    let sc = 1.0;
    if (variantKey && mod.variants && mod.variants[variantKey]) {
        sc = mod.variants[variantKey].surcharge || 1.0;
    }
    const money = Math.round((cat.baseMoney * gs * ss * sc) / 100) * 100;

    // Specific component items required for this category + stage
    const stageData = STAGE_ITEMS_DATA[catKey];
    const items = (stageData && stageData[stage - 1]) ? stageData[stage - 1] : [];

    return { stage, money, items };
}

function calcPI(grade, stages) {
    let pi = PI_CONFIG.basePi[grade] || 100;
    for (const [cat, stageNum] of Object.entries(stages)) {
        const pts = PI_CONFIG.piPerStage[cat];
        if (!pts) continue;
        for (let s = 0; s < stageNum && s < pts.length; s++) pi += pts[s];
    }
    return Math.min(pi, 999);
}

function getPIClass(pi) {
    for (const t of PI_CONFIG.classThresholds) {
        if (pi >= t.min && pi <= t.max) return { label:t.label, color:t.color };
    }
    return { label:'S', color:'#ff4757' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL / COSMETIC DATA  (unchanged from v1)
// ═══════════════════════════════════════════════════════════════════════════════
const VISUAL_MODS = {
    spoiler:     { name:'Spoiler',        modType:0,  group:'body'      },
    fbumper:     { name:'Front Bumper',   modType:1,  group:'body'      },
    rbumper:     { name:'Rear Bumper',    modType:2,  group:'body'      },
    skirts:      { name:'Side Skirts',    modType:3,  group:'body'      },
    hood:        { name:'Hood',           modType:7,  group:'body'      },
    roof:        { name:'Roof',           modType:10, group:'body'      },
    fender:      { name:'Fender',         modType:8,  group:'body'      },
    rfender:     { name:'Right Fender',   modType:9,  group:'body'      },
    archcover:   { name:'Arch Cover',     modType:42, group:'body'      },
    aerials:     { name:'Aerials',        modType:43, group:'body'      },
    trimext:     { name:'Trim',           modType:44, group:'body'      },
    grille:      { name:'Grille',         modType:6,  group:'exterior'  },
    exhaust:     { name:'Exhaust',        modType:4,  group:'exterior'  },
    ornaments:   { name:'Ornaments',      modType:28, group:'exterior'  },
    hydraulics:  { name:'Hydraulics',     modType:38, group:'exterior'  },
    windows:     { name:'Window Tint',    modType:46, group:'exterior'  },
    frame:       { name:'Roll Cage',      modType:5,  group:'enginebay' },
    engineblock: { name:'Engine Block',   modType:39, group:'enginebay' },
    airfilter:   { name:'Air Filter',     modType:40, group:'enginebay' },
    struts:      { name:'Struts',         modType:41, group:'enginebay' },
    tank:        { name:'Tank',           modType:45, group:'enginebay' },
    dashboard:   { name:'Dashboard',      modType:29, group:'interior'  },
    dial:        { name:'Dial Design',    modType:30, group:'interior'  },
    seats:       { name:'Seats',          modType:32, group:'interior'  },
    steeringw:   { name:'Steering Wheel', modType:33, group:'interior'  },
    doorspeaker: { name:'Door Speakers',  modType:31, group:'interior'  },
    speakers:    { name:'Speakers',       modType:36, group:'interior'  },
    columnshift: { name:'Shifter',        modType:34, group:'interior'  },
    plaques:     { name:'Plaques',        modType:35, group:'interior'  },
    trunk:       { name:'Trunk',          modType:37, group:'interior'  },
    livery:      { name:'Livery',         modType:48, group:'livery'    },
    livery2:     { name:'Livery 2',       modType:49, group:'livery'    },
    horn:        { name:'Horn',           modType:14, group:'other'     }
};

const VISUAL_PRICES = {
    F:{ base:500,  perMod:200  }, E:{ base:800,   perMod:300  },
    D:{ base:1200, perMod:500  }, C:{ base:2000,  perMod:800  },
    B:{ base:3500, perMod:1200 }, A:{ base:5000,  perMod:1800 },
    S:{ base:8000, perMod:2500 }
};

const TUNING_SHOPS = [
    { id:'burton',     name:'Los Santos Customs', pos:{ x:-337.13,  y:-136.96,  z:39.01  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } },
    { id:'lsia',       name:'Los Santos Customs', pos:{ x:-1155.46, y:-2007.16, z:13.18  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } },
    { id:'harmony',    name:'Los Santos Customs', pos:{ x:731.58,   y:-1088.77, z:22.17  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } },
    { id:'strawberry', name:'Los Santos Customs', pos:{ x:-211.34,  y:-1323.24, z:30.48  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } },
    { id:'senora',     name:'Los Santos Customs', pos:{ x:1174.96,  y:2640.11,  z:37.35  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } },
    { id:'paleto',     name:'Los Santos Customs', pos:{ x:109.99,   y:6627.20,  z:31.38  }, marker:{ type:1, color:[0,168,255,180], scale:1.5 } }
];

const PAINT_TYPES = [
    { id:0, name:'Normal', icon:'🎨' }, { id:1, name:'Metallic', icon:'✨' },
    { id:2, name:'Pearl',  icon:'💎' }, { id:3, name:'Matte',    icon:'🖤' },
    { id:4, name:'Metal',  icon:'🔩' }, { id:5, name:'Chrome',   icon:'🪞' }
];

const PRESET_COLORS = [
    { name:'Racing Red',      r:192,g:14, b:26  }, { name:'Dark Red',       r:106,g:10, b:10  },
    { name:'Candy Red',       r:182,g:17, b:27  }, { name:'Sunset Red',     r:210,g:60, b:60  },
    { name:'Orange',          r:234,g:142,b:36  }, { name:'Bright Orange',  r:255,g:128,b:0   },
    { name:'Race Yellow',     r:238,g:198,b:30  }, { name:'Bronze',         r:145,g:115,b:45  },
    { name:'Gold',            r:218,g:175,b:60  }, { name:'Dark Green',     r:14, g:70, b:20  },
    { name:'Racing Green',    r:0,  g:100,b:50  }, { name:'Lime Green',     r:102,g:184,b:31  },
    { name:'Gasoline Green',  r:25, g:120,b:80  }, { name:'Dark Blue',      r:12, g:30, b:82  },
    { name:'Midnight Blue',   r:15, g:25, b:60  }, { name:'Galaxy Blue',    r:30, g:60, b:130 },
    { name:'Racing Blue',     r:0,  g:84, b:165 }, { name:'Ultra Blue',     r:0,  g:168,b:255 },
    { name:'Light Blue',      r:106,g:170,b:210 }, { name:'Midnight Purple',r:60, g:10, b:90  },
    { name:'Bright Purple',   r:120,g:30, b:180 }, { name:'Hot Pink',       r:210,g:30, b:120 },
    { name:'Salmon Pink',     r:210,g:120,b:130 }, { name:'Frost White',    r:234,g:234,b:234 },
    { name:'Ice White',       r:252,g:252,b:252 }, { name:'Cream',          r:235,g:225,b:200 },
    { name:'Silver',          r:165,g:165,b:170 }, { name:'Slate Grey',     r:108,g:108,b:112 },
    { name:'Graphite',        r:60, g:60, b:60  }, { name:'Anthracite',     r:38, g:38, b:42  },
    { name:'Black',           r:14, g:14, b:14  }, { name:'Carbon Black',   r:25, g:25, b:25  }
];

const COLOR_PRICES = {
    F:{ preset:300,  custom:800,   paintType:500  }, E:{ preset:500,  custom:1200,  paintType:800  },
    D:{ preset:800,  custom:2000,  paintType:1200 }, C:{ preset:1200, custom:3000,  paintType:1800 },
    B:{ preset:2000, custom:5000,  paintType:3000 }, A:{ preset:3000, custom:7500,  paintType:4500 },
    S:{ preset:5000, custom:12000, paintType:7000 }
};

const WHEEL_TYPES = [
    { id:0, name:'Sport' }, { id:1, name:'Muscle'   }, { id:2, name:'Lowrider' },
    { id:3, name:'SUV'   }, { id:4, name:'Offroad'  }, { id:5, name:'Tuner'    },
    { id:7, name:'High End' }
];

const XENON_COLORS = [
    { id:-1,name:'Default',      hex:'#faf8dc' }, { id:0, name:'White',        hex:'#ffffff' },
    { id:1, name:'Blue',         hex:'#2196F3' }, { id:2, name:'Electric Blue',hex:'#00bcd4' },
    { id:3, name:'Mint Green',   hex:'#98ff98' }, { id:4, name:'Lime Green',   hex:'#32cd32' },
    { id:5, name:'Yellow',       hex:'#ffeb3b' }, { id:6, name:'Golden',       hex:'#ffc107' },
    { id:7, name:'Orange',       hex:'#ff9800' }, { id:8, name:'Red',          hex:'#f44336' },
    { id:9, name:'Pony Pink',    hex:'#ff69b4' }, { id:10,name:'Hot Pink',     hex:'#ff1493' },
    { id:11,name:'Purple',       hex:'#9c27b0' }, { id:12,name:'Blacklight',   hex:'#4a0080' }
];

const PLATE_STYLES = [
    { id:0,name:'Blue on White 1' }, { id:1,name:'Yellow on Black' },
    { id:2,name:'Gold on Blue'    }, { id:3,name:'Blue on White 2' },
    { id:4,name:'Blue on White 3' }, { id:5,name:'Yankton'         }
];

const NEON_PRESETS = [
    { name:'White',        r:255,g:255,b:255 }, { name:'Blue',         r:0,  g:100,b:255 },
    { name:'Electric Blue',r:0,  g:200,b:255 }, { name:'Mint Green',   r:0,  g:255,b:140 },
    { name:'Lime Green',   r:0,  g:255,b:0   }, { name:'Yellow',       r:255,g:255,b:0   },
    { name:'Orange',       r:255,g:150,b:0   }, { name:'Red',          r:255,g:0,  b:0   },
    { name:'Pink',         r:255,g:0,  b:150 }, { name:'Purple',       r:150,g:0,  b:255 }
];

const PEARLESCENT_COLORS = [
    { name:'Pearl White',    r:254,g:254,b:254,gtaIndex:134 }, { name:'Pearl Ice',     r:220,g:230,b:240,gtaIndex:112 },
    { name:'Pearl Blue',     r:100,g:160,b:230,gtaIndex:64  }, { name:'Pearl Aqua',    r:80, g:210,b:200,gtaIndex:49  },
    { name:'Pearl Mint',     r:130,g:224,b:170,gtaIndex:72  }, { name:'Pearl Green',   r:100,g:200,b:100,gtaIndex:48  },
    { name:'Pearl Yellow',   r:240,g:225,b:120,gtaIndex:89  }, { name:'Pearl Gold',    r:230,g:190,b:80, gtaIndex:37  },
    { name:'Pearl Orange',   r:240,g:160,b:60, gtaIndex:38  }, { name:'Pearl Salmon',  r:230,g:140,b:120,gtaIndex:36  },
    { name:'Pearl Red',      r:220,g:60, b:60, gtaIndex:28  }, { name:'Pearl Pink',    r:230,g:100,b:160,gtaIndex:136 },
    { name:'Pearl Hot Pink', r:255,g:50, b:150,gtaIndex:135 }, { name:'Pearl Purple',  r:160,g:70, b:210,gtaIndex:145 },
    { name:'Pearl Champagne',r:235,g:220,b:190,gtaIndex:93  }, { name:'Pearl Graphite',r:90, g:90, b:100,gtaIndex:11  }
];

const WHEEL_COLORS = [
    { name:'Stock',       r:-1, g:-1, b:-1, gtaIndex:-1  }, { name:'Black',       r:10, g:10, b:10, gtaIndex:0   },
    { name:'Carbon Black',r:25, g:25, b:25, gtaIndex:1   }, { name:'Anthracite',  r:50, g:50, b:55, gtaIndex:11  },
    { name:'Silver',      r:165,g:165,b:170,gtaIndex:4   }, { name:'Chrome',      r:220,g:220,b:225,gtaIndex:120 },
    { name:'White',       r:240,g:240,b:240,gtaIndex:134 }, { name:'Gold',        r:200,g:170,b:50, gtaIndex:37  },
    { name:'Bronze',      r:140,g:100,b:40, gtaIndex:90  }, { name:'Copper',      r:180,g:110,b:60, gtaIndex:36  },
    { name:'Red',         r:180,g:20, b:20, gtaIndex:28  }, { name:'Blue',        r:20, g:60, b:180,gtaIndex:64  },
    { name:'Green',       r:20, g:120,b:40, gtaIndex:48  }, { name:'Purple',      r:100,g:20, b:160,gtaIndex:145 },
    { name:'Pink',        r:200,g:50, b:120,gtaIndex:135 }, { name:'Orange',      r:220,g:120,b:20, gtaIndex:38  }
];

const SPECIAL_PRICES = {
    F:{ wheels:800,  wheelColor:400, xenon:400, xenonColor:300, plate:200, neon:1500, neonColor:500, smoke:800, smokeColor:400, camber:500, trackWidth:500 },
    E:{ wheels:1200, wheelColor:600, xenon:600, xenonColor:400, plate:300, neon:2500, neonColor:800, smoke:1200,smokeColor:600, camber:800, trackWidth:800 },
    D:{ wheels:2000, wheelColor:1000,xenon:1000,xenonColor:600, plate:500, neon:4000, neonColor:1200,smoke:2000,smokeColor:1000,camber:1500,trackWidth:1500},
    C:{ wheels:3000, wheelColor:1500,xenon:1500,xenonColor:900, plate:800, neon:6000, neonColor:1800,smoke:3000,smokeColor:1500,camber:2000,trackWidth:2000},
    B:{ wheels:5000, wheelColor:2500,xenon:2500,xenonColor:1500,plate:1200,neon:10000,neonColor:3000,smoke:5000,smokeColor:2500,camber:3500,trackWidth:3500},
    A:{ wheels:8000, wheelColor:4000,xenon:4000,xenonColor:2500,plate:2000,neon:15000,neonColor:4500,smoke:8000,smokeColor:4000,camber:5000,trackWidth:5000},
    S:{ wheels:12000,wheelColor:6000,xenon:6000,xenonColor:4000,plate:3000,neon:22000,neonColor:7000,smoke:12000,smokeColor:6000,camber:8000,trackWidth:8000}
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    PART_ITEMS, PART_RARITIES,
    VARIANT_BRANDS, BUILD_STYLES, TENDENCY_LABELS,
    PI_CLASS_ORDER, PI_CLASS_STAGE_CAPS, PI_SLIDER_RANGE_SCALE,
    DRIFT_MODE_THRESHOLD, STYLE_UNLOCK_THRESHOLD, OFFROAD_VEHICLE_TYPES,
    DRIFT_MODE_HANDLING, HANDLING_SAFETY_CAPS,
    PERFORMANCE_MODS, PERF_GROUP_LABELS, PERF_GROUP_ORDER,
    PI_CONFIG, PERF_COST_FORMULA, STAGE_ITEMS_DATA,
    isPIClassAtLeast, getEffectiveMaxStage, getAvailableVariants,
    getCategoryLockState, calcAllHandling, calcBuildTendency,
    calcDriftModeActive, calcUpgradeReq, calcPI, getPIClass,
    VISUAL_MODS, VISUAL_PRICES, TUNING_SHOPS,
    PAINT_TYPES, PRESET_COLORS, PEARLESCENT_COLORS, COLOR_PRICES,
    WHEEL_TYPES, WHEEL_COLORS, XENON_COLORS,
    PLATE_STYLES, NEON_PRESETS, SPECIAL_PRICES
};