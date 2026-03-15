// packages/data/tuningConfig.js
// Full tuning configuration — brand variants, per-part sliders, PI scoring

// ─── Part Rarities ───
const PART_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const PART_ITEMS = {
    common:    'car_part_common',
    uncommon:  'car_part_uncommon',
    rare:      'car_part_rare',
    epic:      'car_part_epic',
    legendary: 'car_part_legendary'
};

// ═══════════════════════════════════════════════════════════════════════
// BRAND REGISTRY — Fictional GTA-universe brands for the variant system
// ═══════════════════════════════════════════════════════════════════════
const VARIANT_BRANDS = {
    dinka:    { name: 'Dinka',    color: '#00a8ff', tag: 'Grip',    desc: 'Japanese precision — traction & stability' },
    bravado:  { name: 'Bravado',  color: '#ff4757', tag: 'Power',   desc: 'American muscle — raw power & speed' },
    karin:    { name: 'Karin',    color: '#ff6b35', tag: 'Drift',   desc: 'Tuner culture — oversteer & angle' },
    standard: { name: 'Standard', color: '#8a8fa6', tag: 'Default', desc: 'OEM specification' }
};

// Auto-classify tendency labels for the build badge
const TENDENCY_LABELS = {
    grip:     { name: 'Grip Build',    color: '#00a8ff', icon: '🏁' },
    power:    { name: 'Power Build',   color: '#ff4757', icon: '🚀' },
    drift:    { name: 'Drift Build',   color: '#ff6b35', icon: '🌀' },
    balanced: { name: 'Balanced',      color: '#8a8fa6', icon: '⚖' }
};

// ═══════════════════════════════════════════════════════════════════════
// PERFORMANCE SYSTEM — Categories with brand variants & per-part sliders
// ═══════════════════════════════════════════════════════════════════════
//
// Each category has upgrade tiers (stages). At each tier the player
// picks a VARIANT (brand) that shifts handling differently.
// After upgrading, per-part tuning SLIDERS unlock for fine-tuning.
//
// Handling curves: index = stage (0=stock … N). Values are MULTIPLIERS
// applied to the vehicle's stock handling. All categories combine
// multiplicatively: final = stock × engine × turbo × tires × …

const PERFORMANCE_MODS = {
    // ═══ POWER ═══
    engine: {
        name: "Engine", icon: "🔧", modType: 11, isVirtual: false,
        maxStage: 5, group: "power",
        description: [
            "Stock Engine",
            "Stage 1 — Bolt-ons, cold air intake",
            "Stage 2 — Ported heads, headers",
            "Stage 3 — Forged internals",
            "Stage 4 — Built motor, big cams",
            "Stage 5 — Full race engine"
        ],
        variants: {
            dinka: {
                name: "Dinka Precision", tag: "Balanced", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 1, power: 1, drift: 0 },
                desc: "Smooth, reliable power delivery across the rev range.",
                handling: {
                    fInitialDriveForce: [1.0, 1.05, 1.12, 1.20, 1.30, 1.42]
                }
            },
            bravado: {
                name: "Bravado Stroker", tag: "Power", tagColor: "#ff4757",
                surcharge: 1.25,
                tendency: { grip: 0, power: 3, drift: 0 },
                desc: "Aggressive cam profile. Maximum top-end horsepower.",
                handling: {
                    fInitialDriveForce: [1.0, 1.07, 1.15, 1.25, 1.37, 1.52]
                }
            }
        },
        sliders: [
            {
                key: 'powerBand', name: 'Power Band', icon: '📊',
                minStage: 2,
                description: 'Shift power between low-end torque and high-rev horsepower',
                leftLabel: 'Torque', rightLabel: 'Horsepower', default: 0.5,
                properties: {
                    fInitialDriveForce: { min: 0.03, max: -0.03 },
                    fDriveInertia:      { min: -0.06, max: 0.06 }
                }
            }
        ]
    },

    turbo: {
        name: "Forced Induction", icon: "🌀", modType: 18, isVirtual: false,
        maxStage: 3, group: "power",
        description: [
            "Naturally Aspirated",
            "Stage 1 — Small turbo kit",
            "Stage 2 — Mid-frame turbo",
            "Stage 3 — Big turbo / twin setup"
        ],
        variants: {
            dinka: {
                name: "Dinka Twin-Scroll", tag: "Responsive", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 1, power: 1, drift: 0 },
                desc: "Quick-spooling twin scroll. Minimal lag, smooth power.",
                handling: {
                    fInitialDriveForce: [1.0, 1.06, 1.14, 1.24],
                    fDriveInertia:      [1.0, 0.96, 0.92, 0.87]
                }
            },
            bravado: {
                name: "Bravado Big Single", tag: "Power", tagColor: "#ff4757",
                surcharge: 1.3,
                tendency: { grip: 0, power: 3, drift: 0 },
                desc: "Massive turbo. Explosive top-end with noticeable lag.",
                handling: {
                    fInitialDriveForce: [1.0, 1.10, 1.22, 1.36]
                }
            },
            karin: {
                name: "Karin Anti-Lag", tag: "Drift", tagColor: "#ff6b35",
                surcharge: 1.2,
                tendency: { grip: 0, power: 1, drift: 2 },
                desc: "Anti-lag system. Instant spool, pops & bangs, easy wheelspin.",
                handling: {
                    fInitialDriveForce: [1.0, 1.08, 1.18, 1.30],
                    fTractionLossMult:  [1.0, 1.05, 1.12, 1.20]
                }
            }
        },
        sliders: [
            {
                key: 'boostPressure', name: 'Boost Pressure', icon: '🔴',
                minStage: 1,
                description: 'Higher boost = more power but harder on traction',
                leftLabel: 'Low', rightLabel: 'High', default: 0.5,
                properties: {
                    fInitialDriveForce: { min: -0.04, max: 0.06 },
                    fTractionLossMult:  { min: -0.02, max: 0.04 }
                }
            }
        ]
    },

    ecu: {
        name: "ECU Tuning", icon: "💻", modType: 210, isVirtual: true,
        maxStage: 3, group: "power",
        description: [
            "Stock ECU",
            "Stage 1 — Flash tune",
            "Stage 2 — Custom dyno map",
            "Stage 3 — Standalone ECU"
        ],
        variants: {
            dinka: {
                name: "Dinka Safe Tune", tag: "Conservative", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 1, power: 0, drift: 0 },
                desc: "Safe, efficient calibration. Optimized for longevity.",
                handling: { fInitialDriveForce: [1.0, 1.03, 1.07, 1.12] }
            },
            bravado: {
                name: "Bravado Race Flash", tag: "Aggressive", tagColor: "#ff4757",
                surcharge: 1.15,
                tendency: { grip: 0, power: 2, drift: 0 },
                desc: "Aggressive timing maps. Maximum power extraction.",
                handling: {
                    fInitialDriveForce: [1.0, 1.04, 1.09, 1.15],
                    fDriveInertia:      [1.0, 0.97, 0.94, 0.90]
                }
            }
        },
        sliders: []
    },

    exhaust_perf: {
        name: "Exhaust System", icon: "💨", modType: 211, isVirtual: true,
        maxStage: 3, group: "power",
        description: [
            "Stock Exhaust",
            "Stage 1 — Cat-back system",
            "Stage 2 — Headers + cat-delete",
            "Stage 3 — Full race exhaust"
        ],
        variants: {
            dinka: {
                name: "Dinka Sport Exhaust", tag: "Balanced", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 0, power: 1, drift: 0 },
                desc: "Optimized backpressure. Better flow, no drone.",
                handling: { fInitialDriveForce: [1.0, 1.02, 1.05, 1.09] }
            },
            bravado: {
                name: "Bravado Straight Pipe", tag: "Loud", tagColor: "#ff4757",
                surcharge: 1.1,
                tendency: { grip: 0, power: 2, drift: 0 },
                desc: "Zero restriction. Maximum flow and volume.",
                handling: { fInitialDriveForce: [1.0, 1.03, 1.07, 1.12] }
            }
        },
        sliders: []
    },

    // ═══ DRIVETRAIN ═══
    transmission: {
        name: "Transmission", icon: "⚙️", modType: 13, isVirtual: false,
        maxStage: 4, group: "drivetrain",
        description: [
            "Stock Transmission",
            "Stage 1 — Short-throw shifter",
            "Stage 2 — Close-ratio gearbox",
            "Stage 3 — Sequential gearbox",
            "Stage 4 — Dog-box racing trans"
        ],
        variants: {
            dinka: {
                name: "Dinka Race Sequential", tag: "Grip", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 2, power: 0, drift: 0 },
                desc: "Precise, fast shifts. Optimized ratios for circuit racing.",
                handling: {
                    fClutchChangeRateScaleUpShift:   [1.0, 1.15, 1.30, 1.50, 1.70],
                    fClutchChangeRateScaleDownShift:  [1.0, 1.10, 1.20, 1.35, 1.50],
                    fDriveInertia:                    [1.0, 0.95, 0.90, 0.84, 0.78]
                }
            },
            bravado: {
                name: "Bravado Close-Ratio", tag: "Power", tagColor: "#ff4757",
                surcharge: 1.25,
                tendency: { grip: 0, power: 2, drift: 0 },
                desc: "Ultra-fast shifts, tight gearing. Built for drag.",
                handling: {
                    fClutchChangeRateScaleUpShift:   [1.0, 1.20, 1.42, 1.68, 1.95],
                    fClutchChangeRateScaleDownShift:  [1.0, 1.12, 1.25, 1.40, 1.55],
                    fDriveInertia:                    [1.0, 0.97, 0.93, 0.89, 0.85]
                }
            },
            karin: {
                name: "Karin Drift Box", tag: "Drift", tagColor: "#ff6b35",
                surcharge: 1.15,
                tendency: { grip: 0, power: 0, drift: 3 },
                desc: "Spaced ratios for sustained wheelspin. Quick downshift blips.",
                handling: {
                    fClutchChangeRateScaleUpShift:   [1.0, 1.10, 1.22, 1.35, 1.50],
                    fClutchChangeRateScaleDownShift:  [1.0, 1.15, 1.32, 1.50, 1.70],
                    fDriveInertia:                    [1.0, 0.93, 0.86, 0.78, 0.70]
                }
            }
        },
        sliders: [
            {
                key: 'finalDrive', name: 'Final Drive', icon: '⚙',
                minStage: 2,
                description: 'Short = explosive acceleration, Long = higher top speed',
                leftLabel: 'Short', rightLabel: 'Long', default: 0.5,
                properties: {
                    fInitialDriveForce: { min: 0.04, max: -0.04 },
                    fInitialDragCoeff:  { min: 0.02, max: -0.02 }
                }
            }
        ]
    },

    differential: {
        name: "Differential", icon: "⚡", modType: 214, isVirtual: true,
        maxStage: 3, group: "drivetrain",
        description: [
            "Stock Open Diff",
            "Stage 1 — Limited-slip differential",
            "Stage 2 — Mechanical LSD",
            "Stage 3 — Active racing differential"
        ],
        variants: {
            dinka: {
                name: "Dinka Performance LSD", tag: "Grip", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 2, power: 0, drift: 0 },
                desc: "Tight lock for corner exit traction. Hooks up hard.",
                handling: { fTractionLossMult: [1.0, 0.90, 0.80, 0.68] }
            },
            karin: {
                name: "Karin Drift LSD", tag: "Drift", tagColor: "#ff6b35",
                surcharge: 1.15,
                tendency: { grip: 0, power: 0, drift: 3 },
                desc: "Open under braking, locks under power. Promotes oversteer.",
                handling: {
                    fTractionLossMult:  [1.0, 1.05, 1.12, 1.22],
                    fTractionBiasFront: [1.0, 0.97, 0.94, 0.90]
                }
            }
        },
        sliders: [
            {
                key: 'lockPct', name: 'Lock Percentage', icon: '🔒',
                minStage: 1,
                description: 'Open = less understeer, Locked = more traction out of corners',
                leftLabel: 'Open', rightLabel: 'Locked', default: 0.5,
                properties: { fTractionLossMult: { min: 0.06, max: -0.08 } }
            }
        ]
    },

    // ═══ HANDLING ═══
    brakes: {
        name: "Brakes", icon: "🛑", modType: 12, isVirtual: false,
        maxStage: 4, group: "handling",
        description: [
            "Stock Brakes",
            "Stage 1 — Drilled rotors + pads",
            "Stage 2 — Slotted rotors + SS lines",
            "Stage 3 — Big brake kit, 6-piston",
            "Stage 4 — Carbon ceramic brakes"
        ],
        variants: {
            dinka: {
                name: "Dinka Track Spec", tag: "Grip", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 2, power: 0, drift: 0 },
                desc: "Consistent, fade-resistant. Perfect for track use.",
                handling: { fBrakeForce: [1.0, 1.10, 1.22, 1.36, 1.52] }
            },
            bravado: {
                name: "Bravado Heavy Duty", tag: "Power", tagColor: "#ff4757",
                surcharge: 1.2,
                tendency: { grip: 1, power: 1, drift: 0 },
                desc: "Massive calipers with extreme bite. Heavy but powerful.",
                handling: { fBrakeForce: [1.0, 1.14, 1.30, 1.48, 1.68] }
            }
        },
        sliders: [
            {
                key: 'brakeBias', name: 'Brake Bias', icon: '⏹',
                minStage: 1,
                description: 'Front = stable under braking, Rear = easier to rotate the car',
                leftLabel: 'Rear', rightLabel: 'Front', default: 0.55,
                properties: { fBrakeBiasFront: { min: -0.10, max: 0.10 } }
            }
        ]
    },

    suspension: {
        name: "Suspension", icon: "🔩", modType: 15, isVirtual: false,
        maxStage: 4, group: "handling",
        description: [
            "Stock Suspension",
            "Stage 1 — Lowering springs",
            "Stage 2 — Sport coilovers",
            "Stage 3 — Race adjustable coilovers",
            "Stage 4 — Competition setup"
        ],
        variants: {
            dinka: {
                name: "Dinka Sport", tag: "Grip", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 3, power: 0, drift: 0 },
                desc: "Stiff, responsive. Flat cornering for maximum grip.",
                handling: {
                    fSuspensionForce:  [1.0, 1.08, 1.18, 1.28, 1.40],
                    fAntiRollBarForce: [1.0, 1.06, 1.14, 1.22, 1.32]
                }
            },
            karin: {
                name: "Karin Drift Spec", tag: "Drift", tagColor: "#ff6b35",
                surcharge: 1.15,
                tendency: { grip: 0, power: 0, drift: 3 },
                desc: "Soft setup for weight transfer. Promotes controlled slides.",
                handling: {
                    fSuspensionForce:  [1.0, 0.94, 0.88, 0.82, 0.76],
                    fAntiRollBarForce: [1.0, 0.92, 0.84, 0.76, 0.68]
                }
            }
        },
        sliders: [
            {
                key: 'stiffness', name: 'Spring Rate', icon: '🔩',
                minStage: 1,
                description: 'Soft = more grip on bumps. Hard = sharper direction change.',
                leftLabel: 'Soft', rightLabel: 'Hard', default: 0.5,
                properties: {
                    fSuspensionForce:  { min: -0.07, max: 0.10 },
                    fAntiRollBarForce: { min: -0.04, max: 0.06 }
                }
            },
            {
                key: 'rideHeight', name: 'Ride Height', icon: '📐',
                minStage: 2,
                description: 'Low = better center of gravity. High = more clearance.',
                leftLabel: 'Low', rightLabel: 'High', default: 0.4,
                properties: {
                    fSuspensionRaise: { min: -0.06, max: 0.06 }
                }
            }
        ]
    },

    tires: {
        name: "Tires", icon: "🏎️", modType: 213, isVirtual: true,
        maxStage: 4, group: "handling",
        description: [
            "Stock Tires",
            "Stage 1 — Sport compound",
            "Stage 2 — Semi-slick",
            "Stage 3 — Full slick tires",
            "Stage 4 — Racing slicks, max grip"
        ],
        variants: {
            dinka: {
                name: "Dinka Grip Max", tag: "Grip", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 3, power: 0, drift: 0 },
                desc: "Maximum traction compound. Sticks like glue on tarmac.",
                handling: {
                    fTractionCurveMax: [1.0, 1.06, 1.14, 1.24, 1.35],
                    fTractionCurveMin: [1.0, 1.05, 1.11, 1.19, 1.28]
                }
            },
            bravado: {
                name: "Bravado Drag Slick", tag: "Drag", tagColor: "#ff4757",
                surcharge: 1.2,
                tendency: { grip: 0, power: 2, drift: 0 },
                desc: "Rear-biased compound for launches. Hooks up off the line.",
                handling: {
                    fTractionCurveMax: [1.0, 1.02, 1.06, 1.10, 1.15],
                    fTractionCurveMin: [1.0, 1.08, 1.18, 1.30, 1.42]
                }
            },
            karin: {
                name: "Karin Slide Compound", tag: "Drift", tagColor: "#ff6b35",
                surcharge: 1.1,
                tendency: { grip: 0, power: 0, drift: 3 },
                desc: "Reduced grip for controlled slides. The drifter's choice.",
                handling: {
                    fTractionCurveMax: [1.0, 0.96, 0.92, 0.88, 0.84],
                    fTractionCurveMin: [1.0, 0.94, 0.88, 0.82, 0.76],
                    fTractionLossMult: [1.0, 1.08, 1.18, 1.30, 1.44]
                }
            }
        },
        sliders: [
            {
                key: 'tirePressure', name: 'Tire Pressure', icon: '🎈',
                minStage: 1,
                description: 'Low = more grip but more drag. High = less grip but faster.',
                leftLabel: 'Low', rightLabel: 'High', default: 0.5,
                properties: {
                    fTractionCurveMax:  { min: 0.04, max: -0.04 },
                    fInitialDragCoeff:  { min: 0.02, max: -0.02 }
                }
            }
        ]
    },

    // ═══ CHASSIS ═══
    rollcage: {
        name: "Roll Cage", icon: "🛡️", modType: 215, isVirtual: true,
        maxStage: 2, group: "chassis",
        description: [
            "No Roll Cage",
            "Stage 1 — Half cage, improved rigidity",
            "Stage 2 — Full cage, maximum rigidity"
        ],
        variants: {
            standard: {
                name: "Standard Cage", tag: "Universal", tagColor: "#8a8fa6",
                surcharge: 1.0,
                tendency: { grip: 1, power: 0, drift: 0 },
                desc: "Chromoly steel cage. Better chassis rigidity.",
                handling: {
                    fRollCentreHeightFront: [1.0, 0.88, 0.76],
                    fRollCentreHeightRear:  [1.0, 0.88, 0.76]
                }
            }
        },
        sliders: []
    },

    weight: {
        name: "Weight Reduction", icon: "🪶", modType: 216, isVirtual: true,
        maxStage: 4, group: "chassis",
        description: [
            "Stock Weight",
            "Stage 1 — Lightweight battery & wheels",
            "Stage 2 — Carbon panels, stripped rear",
            "Stage 3 — Gutted interior, lexan windows",
            "Stage 4 — Full carbon shell"
        ],
        variants: {
            dinka: {
                name: "Dinka Balanced Strip", tag: "Balanced", tagColor: "#00a8ff",
                surcharge: 1.0,
                tendency: { grip: 1, power: 1, drift: 0 },
                desc: "Strategic weight savings while maintaining balance.",
                handling: {
                    fMass:             [1.0, 0.96, 0.91, 0.85, 0.78],
                    fInitialDragCoeff: [1.0, 0.98, 0.95, 0.92, 0.88]
                }
            },
            bravado: {
                name: "Bravado Extreme Strip", tag: "Aggressive", tagColor: "#ff4757",
                surcharge: 1.3,
                tendency: { grip: 0, power: 2, drift: 1 },
                desc: "Ruthless weight reduction. Strip everything non-essential.",
                handling: {
                    fMass:             [1.0, 0.94, 0.87, 0.79, 0.70],
                    fInitialDragCoeff: [1.0, 0.97, 0.93, 0.88, 0.82]
                }
            }
        },
        sliders: []
    }
};

// Group labels for UI sidebar
const PERF_GROUP_LABELS = {
    power: 'Power', drivetrain: 'Drivetrain',
    handling: 'Handling', chassis: 'Chassis'
};
const PERF_GROUP_ORDER = ['power', 'drivetrain', 'handling', 'chassis'];

// ─── Performance Index (PI) System ───
const PI_CONFIG = {
    basePi: { F: 100, E: 175, D: 260, C: 370, B: 500, A: 650, S: 820 },
    classThresholds: [
        { min: 0,   max: 150, label: 'F', color: '#555555' },
        { min: 151, max: 275, label: 'E', color: '#8a8fa6' },
        { min: 276, max: 400, label: 'D', color: '#00a8ff' },
        { min: 401, max: 550, label: 'C', color: '#2ecc71' },
        { min: 551, max: 700, label: 'B', color: '#f39c12' },
        { min: 701, max: 850, label: 'A', color: '#ff6b35' },
        { min: 851, max: 999, label: 'S', color: '#ff4757' }
    ],
    piPerStage: {
        engine:       [8, 12, 18, 24, 32],
        turbo:        [14, 22, 32],
        ecu:          [3, 6, 10],
        exhaust_perf: [2, 4, 7],
        transmission: [5, 8, 12, 16],
        differential: [4, 6, 10],
        brakes:       [4, 7, 10, 14],
        suspension:   [4, 7, 10, 14],
        tires:        [6, 10, 14, 20],
        rollcage:     [3, 6],
        weight:       [5, 8, 12, 18]
    }
};

// ═══════════════════════════════════════════════════════════════════════
// HANDLING CALCULATION (variant + slider)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hard safety caps applied AFTER all variant + slider math.
 * Prevents extreme slider/variant combinations from making vehicles
 * undriveable (excessive rolling, instant spin, zero traction, etc.)
 *
 * min = lowest allowed multiplier (floor)
 * max = highest allowed multiplier (ceiling)
 */
const HANDLING_SAFETY_CAPS = {
    // ── Stability / roll prevention ──────────────────────────────────
    fAntiRollBarForce:      { min: 0.52 }, // below this → extreme body roll on corners
    fSuspensionForce:       { min: 0.58 }, // below this → chassis bottoms out / instability
    fRollCentreHeightFront: { min: 0.68 }, // roll cage + soft susp stacking too low
    fRollCentreHeightRear:  { min: 0.68 },
    // ── Traction floors ──────────────────────────────────────────────
    fTractionCurveMax:      { min: 0.68 }, // drift tires + slider can strip all grip
    fTractionCurveMin:      { min: 0.62 },
    // ── Power / brake ceilings ───────────────────────────────────────
    fInitialDriveForce:     { max: 2.30 }, // prevent uncontrollable wheelspin at all speeds
    fBrakeForce:            { max: 2.20 }, // prevent instant front-lock / flip
    fTractionLossMult:      { max: 1.65 }, // karin drift LSD + anti-lag stacking
};

/**
 * Get the combined handling multipliers from ALL installed parts.
 * Each part contributes its variant's handling curve at the installed stage,
 * plus any per-part slider offsets.  All combine multiplicatively.
 * Safety caps are applied last to prevent extreme value stacking.
 *
 * @param {Object} stages     { catKey: stageNum }          — 0 = stock
 * @param {Object} variants   { catKey: variantKey }        — chosen brand per part
 * @param {Object} sliderData { catKey: { sliderKey: 0…1 } }
 * @returns {Object} { handlingProp: combined multiplier }
 */
function calcAllHandling(stages, variants, sliderData) {
    const combined = {};
    for (const [catKey, mod] of Object.entries(PERFORMANCE_MODS)) {
        const stage = stages[catKey] || 0;
        if (stage === 0) continue;

        const vKeys = Object.keys(mod.variants || {});
        const vk = (variants && variants[catKey]) || vKeys[0];
        const variant = (mod.variants || {})[vk];
        if (!variant || !variant.handling) continue;

        // Variant handling curve at this stage
        for (const [prop, curve] of Object.entries(variant.handling)) {
            const mult = (stage < curve.length) ? curve[stage] : curve[curve.length - 1];
            combined[prop] = (combined[prop] || 1.0) * (mult || 1.0);
        }

        // Per-part slider offsets
        const cs = (sliderData && sliderData[catKey]) || {};
        for (const sl of (mod.sliders || [])) {
            if (stage < sl.minStage) continue;
            const val = cs[sl.key] !== undefined ? cs[sl.key] : sl.default;
            for (const [prop, range] of Object.entries(sl.properties)) {
                const off = range.min + (range.max - range.min) * Math.max(0, Math.min(1, val));
                combined[prop] = (combined[prop] || 1.0) * (1.0 + off);
            }
        }
    }

    // ── Apply safety caps (prevent extreme stacking from causing instability) ──
    for (const [prop, caps] of Object.entries(HANDLING_SAFETY_CAPS)) {
        if (combined[prop] === undefined) continue;
        if (caps.min !== undefined) combined[prop] = Math.max(caps.min, combined[prop]);
        if (caps.max !== undefined) combined[prop] = Math.min(caps.max, combined[prop]);
    }

    return combined;
}

/**
 * Auto-classify the build tendency based on installed variant choices.
 * Only counts parts that are actually installed (stage > 0).
 *
 * @param {Object} variants { catKey: variantKey }
 * @param {Object} stages   { catKey: stageNum }
 * @returns {{ grip, power, drift, dominant, percentage }}
 */
function calcBuildTendency(variants, stages) {
    const s = { grip: 0, power: 0, drift: 0 };
    if (!variants) return { ...s, dominant: 'balanced', percentage: 0 };
    for (const [ck, vk] of Object.entries(variants)) {
        if (!stages || !stages[ck] || stages[ck] === 0) continue;
        const mod = PERFORMANCE_MODS[ck];
        if (!mod) continue;
        const v = (mod.variants || {})[vk];
        if (!v || !v.tendency) continue;
        s.grip  += v.tendency.grip  || 0;
        s.power += v.tendency.power || 0;
        s.drift += v.tendency.drift || 0;
    }
    const total = s.grip + s.power + s.drift;
    if (total === 0) return { ...s, dominant: 'balanced', percentage: 0 };
    let dom = 'balanced', mx = 0;
    for (const [k, v] of Object.entries(s)) {
        if (v > mx) { mx = v; dom = k; }
    }
    if (Object.values(s).filter(v => v === mx).length > 1) dom = 'balanced';
    return { ...s, dominant: dom, percentage: Math.round((mx / total) * 100) };
}

// ─── Upgrade Cost Formula ───
const PERF_COST_FORMULA = {
    categories: {
        engine:       { baseMoney: 2000,  baseParts: 3, partsPerStage: 1, maxParts: 8 },
        turbo:        { baseMoney: 5000,  baseParts: 5, partsPerStage: 1, maxParts: 8 },
        ecu:          { baseMoney: 2500,  baseParts: 3, partsPerStage: 1, maxParts: 6 },
        exhaust_perf: { baseMoney: 1800,  baseParts: 3, partsPerStage: 1, maxParts: 6 },
        transmission: { baseMoney: 1500,  baseParts: 3, partsPerStage: 1, maxParts: 7 },
        differential: { baseMoney: 2000,  baseParts: 3, partsPerStage: 1, maxParts: 6 },
        brakes:       { baseMoney: 1200,  baseParts: 2, partsPerStage: 1, maxParts: 6 },
        suspension:   { baseMoney: 1000,  baseParts: 2, partsPerStage: 1, maxParts: 6 },
        tires:        { baseMoney: 1000,  baseParts: 2, partsPerStage: 1, maxParts: 6 },
        rollcage:     { baseMoney: 3000,  baseParts: 4, partsPerStage: 2, maxParts: 8 },
        weight:       { baseMoney: 3500,  baseParts: 3, partsPerStage: 2, maxParts: 8 }
    },
    gradeScale:  { F: 0.7, E: 1.0, D: 1.4, C: 2.0, B: 3.0, A: 4.5, S: 7.0 },
    stageScale:  [1.0, 1.8, 3.2, 5.5, 9.0],
    gradeIndex:  { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 },
    rarityByTier: [
        'common','common','uncommon','uncommon','rare',
        'rare','epic','epic','legendary','legendary','legendary','legendary'
    ]
};

/**
 * Calculate upgrade cost & part requirements.
 * @param {string} catKey     Category key
 * @param {string} grade      Vehicle grade (F…S)
 * @param {number} stage      Target stage (1-based)
 * @param {string} [variantKey] Optional variant to apply surcharge
 * @returns {{ stage, money, partType, partAmount }} | null
 */
function calcUpgradeReq(catKey, grade, stage, variantKey) {
    const cat = PERF_COST_FORMULA.categories[catKey];
    if (!cat) return null;
    const mod = PERFORMANCE_MODS[catKey];
    if (!mod || stage < 1 || stage > mod.maxStage) return null;

    const gs = PERF_COST_FORMULA.gradeScale[grade] || 1.0;
    const ss = PERF_COST_FORMULA.stageScale[stage - 1] || 1.0;

    // Variant surcharge
    let sc = 1.0;
    if (variantKey && mod.variants && mod.variants[variantKey]) {
        sc = mod.variants[variantKey].surcharge || 1.0;
    }

    const money = Math.round((cat.baseMoney * gs * ss * sc) / 100) * 100;
    const parts = Math.min(cat.baseParts + (stage - 1) * cat.partsPerStage, cat.maxParts);
    const gi = PERF_COST_FORMULA.gradeIndex[grade] || 0;
    const tier = Math.min(gi + (stage - 1), PERF_COST_FORMULA.rarityByTier.length - 1);
    const partType = PERF_COST_FORMULA.rarityByTier[tier];

    return { stage, money, partType, partAmount: parts };
}

function calcPI(grade, stages) {
    let pi = PI_CONFIG.basePi[grade] || 100;
    for (const [cat, stageNum] of Object.entries(stages)) {
        const pts = PI_CONFIG.piPerStage[cat];
        if (!pts) continue;
        for (let s = 0; s < stageNum && s < pts.length; s++) {
            pi += pts[s];
        }
    }
    return Math.min(pi, 999);
}

function getPIClass(pi) {
    for (const t of PI_CONFIG.classThresholds) {
        if (pi >= t.min && pi <= t.max) return { label: t.label, color: t.color };
    }
    return { label: 'S', color: '#ff4757' };
}

// ─── Visual Mod Types ───
const VISUAL_MODS = {
    spoiler:     { name: "Spoiler",        modType: 0,  group: "body" },
    fbumper:     { name: "Front Bumper",   modType: 1,  group: "body" },
    rbumper:     { name: "Rear Bumper",    modType: 2,  group: "body" },
    skirts:      { name: "Side Skirts",    modType: 3,  group: "body" },
    hood:        { name: "Hood",           modType: 7,  group: "body" },
    roof:        { name: "Roof",           modType: 10, group: "body" },
    fender:      { name: "Fender",         modType: 8,  group: "body" },
    rfender:     { name: "Right Fender",   modType: 9,  group: "body" },
    archcover:   { name: "Arch Cover",     modType: 42, group: "body" },
    aerials:     { name: "Aerials",        modType: 43, group: "body" },
    trimext:     { name: "Trim",           modType: 44, group: "body" },
    grille:      { name: "Grille",         modType: 6,  group: "exterior" },
    exhaust:     { name: "Exhaust",        modType: 4,  group: "exterior" },
    ornaments:   { name: "Ornaments",      modType: 28, group: "exterior" },
    hydraulics:  { name: "Hydraulics",     modType: 38, group: "exterior" },
    windows:     { name: "Window Tint",    modType: 46, group: "exterior" },
    frame:       { name: "Roll Cage",      modType: 5,  group: "enginebay" },
    engineblock: { name: "Engine Block",   modType: 39, group: "enginebay" },
    airfilter:   { name: "Air Filter",     modType: 40, group: "enginebay" },
    struts:      { name: "Struts",         modType: 41, group: "enginebay" },
    tank:        { name: "Tank",           modType: 45, group: "enginebay" },
    dashboard:   { name: "Dashboard",      modType: 29, group: "interior" },
    dial:        { name: "Dial Design",    modType: 30, group: "interior" },
    seats:       { name: "Seats",          modType: 32, group: "interior" },
    steeringw:   { name: "Steering Wheel", modType: 33, group: "interior" },
    doorspeaker: { name: "Door Speakers",  modType: 31, group: "interior" },
    speakers:    { name: "Speakers",       modType: 36, group: "interior" },
    columnshift: { name: "Shifter",        modType: 34, group: "interior" },
    plaques:     { name: "Plaques",        modType: 35, group: "interior" },
    trunk:       { name: "Trunk",          modType: 37, group: "interior" },
    livery:      { name: "Livery",         modType: 48, group: "livery" },
    livery2:     { name: "Livery 2",       modType: 49, group: "livery" },
    horn:        { name: "Horn",           modType: 14, group: "other" }
};

const VISUAL_PRICES = {
    F: { base: 500,   perMod: 200  },
    E: { base: 800,   perMod: 300  },
    D: { base: 1200,  perMod: 500  },
    C: { base: 2000,  perMod: 800  },
    B: { base: 3500,  perMod: 1200 },
    A: { base: 5000,  perMod: 1800 },
    S: { base: 8000,  perMod: 2500 }
};

const TUNING_SHOPS = [
    { id: 'burton',     name: "Los Santos Customs", pos: { x: -337.13, y: -136.96, z: 39.01 },   marker: { type: 1, color: [0,168,255,180], scale: 1.5 } },
    { id: 'lsia',       name: "Los Santos Customs", pos: { x: -1155.46, y: -2007.16, z: 13.18 }, marker: { type: 1, color: [0,168,255,180], scale: 1.5 } },
    { id: 'harmony',    name: "Los Santos Customs", pos: { x: 731.58, y: -1088.77, z: 22.17 },   marker: { type: 1, color: [0,168,255,180], scale: 1.5 } },
    { id: 'strawberry', name: "Los Santos Customs", pos: { x: -211.34, y: -1323.24, z: 30.48 },  marker: { type: 1, color: [0,168,255,180], scale: 1.5 } },
    { id: 'senora',     name: "Los Santos Customs", pos: { x: 1174.96, y: 2640.11, z: 37.35 },   marker: { type: 1, color: [0,168,255,180], scale: 1.5 } },
    { id: 'paleto',     name: "Los Santos Customs", pos: { x: 109.99, y: 6627.20, z: 31.38 },    marker: { type: 1, color: [0,168,255,180], scale: 1.5 } }
];

const PAINT_TYPES = [
    { id: 0, name: "Normal",   icon: "🎨" },
    { id: 1, name: "Metallic", icon: "✨" },
    { id: 2, name: "Pearl",    icon: "💎" },
    { id: 3, name: "Matte",    icon: "🖤" },
    { id: 4, name: "Metal",    icon: "🔩" },
    { id: 5, name: "Chrome",   icon: "🪞" }
];

const PRESET_COLORS = [
    { name: "Racing Red",      r: 192, g: 14,  b: 26  },
    { name: "Dark Red",        r: 106, g: 10,  b: 10  },
    { name: "Candy Red",       r: 182, g: 17,  b: 27  },
    { name: "Sunset Red",      r: 210, g: 60,  b: 60  },
    { name: "Orange",          r: 234, g: 142, b: 36  },
    { name: "Bright Orange",   r: 255, g: 128, b: 0   },
    { name: "Race Yellow",     r: 238, g: 198, b: 30  },
    { name: "Bronze",          r: 145, g: 115, b: 45  },
    { name: "Gold",            r: 218, g: 175, b: 60  },
    { name: "Dark Green",      r: 14,  g: 70,  b: 20  },
    { name: "Racing Green",    r: 0,   g: 100, b: 50  },
    { name: "Lime Green",      r: 102, g: 184, b: 31  },
    { name: "Gasoline Green",  r: 25,  g: 120, b: 80  },
    { name: "Dark Blue",       r: 12,  g: 30,  b: 82  },
    { name: "Midnight Blue",   r: 15,  g: 25,  b: 60  },
    { name: "Galaxy Blue",     r: 30,  g: 60,  b: 130 },
    { name: "Racing Blue",     r: 0,   g: 84,  b: 165 },
    { name: "Ultra Blue",      r: 0,   g: 168, b: 255 },
    { name: "Light Blue",      r: 106, g: 170, b: 210 },
    { name: "Midnight Purple", r: 60,  g: 10,  b: 90  },
    { name: "Bright Purple",   r: 120, g: 30,  b: 180 },
    { name: "Hot Pink",        r: 210, g: 30,  b: 120 },
    { name: "Salmon Pink",     r: 210, g: 120, b: 130 },
    { name: "Frost White",     r: 234, g: 234, b: 234 },
    { name: "Ice White",       r: 252, g: 252, b: 252 },
    { name: "Cream",           r: 235, g: 225, b: 200 },
    { name: "Silver",          r: 165, g: 165, b: 170 },
    { name: "Slate Grey",      r: 108, g: 108, b: 112 },
    { name: "Graphite",        r: 60,  g: 60,  b: 60  },
    { name: "Anthracite",      r: 38,  g: 38,  b: 42  },
    { name: "Black",           r: 14,  g: 14,  b: 14  },
    { name: "Carbon Black",    r: 25,  g: 25,  b: 25  }
];

const COLOR_PRICES = {
    F: { preset: 300,   custom: 800,   paintType: 500  },
    E: { preset: 500,   custom: 1200,  paintType: 800  },
    D: { preset: 800,   custom: 2000,  paintType: 1200 },
    C: { preset: 1200,  custom: 3000,  paintType: 1800 },
    B: { preset: 2000,  custom: 5000,  paintType: 3000 },
    A: { preset: 3000,  custom: 7500,  paintType: 4500 },
    S: { preset: 5000,  custom: 12000, paintType: 7000 }
};

const WHEEL_TYPES = [
    { id: 0, name: "Sport" },  { id: 1, name: "Muscle" },
    { id: 2, name: "Lowrider" }, { id: 3, name: "SUV" },
    { id: 4, name: "Offroad" }, { id: 5, name: "Tuner" },
    { id: 7, name: "High End" }
];

const XENON_COLORS = [
    { id: -1, name: "Default",       hex: "#faf8dc" },
    { id: 0,  name: "White",         hex: "#ffffff" },
    { id: 1,  name: "Blue",          hex: "#2196F3" },
    { id: 2,  name: "Electric Blue", hex: "#00bcd4" },
    { id: 3,  name: "Mint Green",    hex: "#98ff98" },
    { id: 4,  name: "Lime Green",    hex: "#32cd32" },
    { id: 5,  name: "Yellow",        hex: "#ffeb3b" },
    { id: 6,  name: "Golden",        hex: "#ffc107" },
    { id: 7,  name: "Orange",        hex: "#ff9800" },
    { id: 8,  name: "Red",           hex: "#f44336" },
    { id: 9,  name: "Pony Pink",     hex: "#ff69b4" },
    { id: 10, name: "Hot Pink",      hex: "#ff1493" },
    { id: 11, name: "Purple",        hex: "#9c27b0" },
    { id: 12, name: "Blacklight",    hex: "#4a0080" }
];

const PLATE_STYLES = [
    { id: 0, name: "Blue on White 1" }, { id: 1, name: "Yellow on Black" },
    { id: 2, name: "Gold on Blue" },    { id: 3, name: "Blue on White 2" },
    { id: 4, name: "Blue on White 3" }, { id: 5, name: "Yankton" }
];

const NEON_PRESETS = [
    { name: "White",         r: 255, g: 255, b: 255 },
    { name: "Blue",          r: 0,   g: 100, b: 255 },
    { name: "Electric Blue", r: 0,   g: 200, b: 255 },
    { name: "Mint Green",    r: 0,   g: 255, b: 140 },
    { name: "Lime Green",    r: 0,   g: 255, b: 0   },
    { name: "Yellow",        r: 255, g: 255, b: 0   },
    { name: "Orange",        r: 255, g: 150, b: 0   },
    { name: "Red",           r: 255, g: 0,   b: 0   },
    { name: "Pink",          r: 255, g: 0,   b: 150 },
    { name: "Purple",        r: 150, g: 0,   b: 255 }
];

const PEARLESCENT_COLORS = [
    { name: "Pearl White",      r: 254, g: 254, b: 254, gtaIndex: 134 },
    { name: "Pearl Ice",        r: 220, g: 230, b: 240, gtaIndex: 112 },
    { name: "Pearl Blue",       r: 100, g: 160, b: 230, gtaIndex: 64  },
    { name: "Pearl Aqua",       r: 80,  g: 210, b: 200, gtaIndex: 49  },
    { name: "Pearl Mint",       r: 130, g: 224, b: 170, gtaIndex: 72  },
    { name: "Pearl Green",      r: 100, g: 200, b: 100, gtaIndex: 48  },
    { name: "Pearl Yellow",     r: 240, g: 225, b: 120, gtaIndex: 89  },
    { name: "Pearl Gold",       r: 230, g: 190, b: 80,  gtaIndex: 37  },
    { name: "Pearl Orange",     r: 240, g: 160, b: 60,  gtaIndex: 38  },
    { name: "Pearl Salmon",     r: 230, g: 140, b: 120, gtaIndex: 36  },
    { name: "Pearl Red",        r: 220, g: 60,  b: 60,  gtaIndex: 28  },
    { name: "Pearl Pink",       r: 230, g: 100, b: 160, gtaIndex: 136 },
    { name: "Pearl Hot Pink",   r: 255, g: 50,  b: 150, gtaIndex: 135 },
    { name: "Pearl Purple",     r: 160, g: 70,  b: 210, gtaIndex: 145 },
    { name: "Pearl Champagne",  r: 235, g: 220, b: 190, gtaIndex: 93  },
    { name: "Pearl Graphite",   r: 90,  g: 90,  b: 100, gtaIndex: 11  }
];

const WHEEL_COLORS = [
    { name: "Stock",           r: -1,  g: -1,  b: -1,  gtaIndex: -1  },
    { name: "Black",           r: 10,  g: 10,  b: 10,  gtaIndex: 0   },
    { name: "Carbon Black",    r: 25,  g: 25,  b: 25,  gtaIndex: 1   },
    { name: "Anthracite",      r: 50,  g: 50,  b: 55,  gtaIndex: 11  },
    { name: "Silver",          r: 165, g: 165, b: 170, gtaIndex: 4   },
    { name: "Chrome",          r: 220, g: 220, b: 225, gtaIndex: 120 },
    { name: "White",           r: 240, g: 240, b: 240, gtaIndex: 134 },
    { name: "Gold",            r: 200, g: 170, b: 50,  gtaIndex: 37  },
    { name: "Bronze",          r: 140, g: 100, b: 40,  gtaIndex: 90  },
    { name: "Copper",          r: 180, g: 110, b: 60,  gtaIndex: 36  },
    { name: "Red",             r: 180, g: 20,  b: 20,  gtaIndex: 28  },
    { name: "Blue",            r: 20,  g: 60,  b: 180, gtaIndex: 64  },
    { name: "Green",           r: 20,  g: 120, b: 40,  gtaIndex: 48  },
    { name: "Purple",          r: 100, g: 20,  b: 160, gtaIndex: 145 },
    { name: "Pink",            r: 200, g: 50,  b: 120, gtaIndex: 135 },
    { name: "Orange",          r: 220, g: 120, b: 20,  gtaIndex: 38  }
];

const SPECIAL_PRICES = {
    F: { wheels: 800,   wheelColor: 400,  xenon: 400,  xenonColor: 300,  plate: 200,  neon: 1500,  neonColor: 500,  smoke: 800,   smokeColor: 400,  camber: 500,   trackWidth: 500  },
    E: { wheels: 1200,  wheelColor: 600,  xenon: 600,  xenonColor: 400,  plate: 300,  neon: 2500,  neonColor: 800,  smoke: 1200,  smokeColor: 600,  camber: 800,   trackWidth: 800  },
    D: { wheels: 2000,  wheelColor: 1000, xenon: 1000, xenonColor: 600,  plate: 500,  neon: 4000,  neonColor: 1200, smoke: 2000,  smokeColor: 1000, camber: 1500,  trackWidth: 1500 },
    C: { wheels: 3000,  wheelColor: 1500, xenon: 1500, xenonColor: 900,  plate: 800,  neon: 6000,  neonColor: 1800, smoke: 3000,  smokeColor: 1500, camber: 2000,  trackWidth: 2000 },
    B: { wheels: 5000,  wheelColor: 2500, xenon: 2500, xenonColor: 1500, plate: 1200, neon: 10000, neonColor: 3000, smoke: 5000,  smokeColor: 2500, camber: 3500,  trackWidth: 3500 },
    A: { wheels: 8000,  wheelColor: 4000, xenon: 4000, xenonColor: 2500, plate: 2000, neon: 15000, neonColor: 4500, smoke: 8000,  smokeColor: 4000, camber: 5000,  trackWidth: 5000 },
    S: { wheels: 12000, wheelColor: 6000, xenon: 6000, xenonColor: 4000, plate: 3000, neon: 22000, neonColor: 7000, smoke: 12000, smokeColor: 6000, camber: 8000,  trackWidth: 8000 }
};

module.exports = {
    PART_ITEMS,
    PART_RARITIES,
    PERFORMANCE_MODS,
    PERF_GROUP_LABELS,
    PERF_GROUP_ORDER,
    PI_CONFIG,
    PERF_COST_FORMULA,
    VARIANT_BRANDS,
    TENDENCY_LABELS,
    calcAllHandling,
    calcBuildTendency,
    calcUpgradeReq,
    calcPI,
    getPIClass,
    VISUAL_MODS,
    VISUAL_PRICES,
    TUNING_SHOPS,
    PAINT_TYPES,
    PRESET_COLORS,
    PEARLESCENT_COLORS,
    COLOR_PRICES,
    WHEEL_TYPES,
    WHEEL_COLORS,
    XENON_COLORS,
    PLATE_STYLES,
    NEON_PRESETS,
    SPECIAL_PRICES
};