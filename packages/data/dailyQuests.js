module.exports = [
    {
        id: 'fuel_consumer',
        title: 'Gas Guzzler',
        description: 'Refuel your vehicle with a total of 50 Liters.',
        type: 'fuel_vehicle',   // Listens for this event
        targetAmount: 50,       // Goal
        progressProp: 'liters', // Uses 'liters' from the event data payload
        reward: 250
    },
    {
        id: 'eco_warrior',
        title: 'Eco Warrior',
        description: 'Recycle 10 items at the Returo station.',
        type: 'recycle_item',
        targetAmount: 10,
        progressProp: 'count',
        reward: 150
    },
    {
        id: 'cardio_king',
        title: 'Cardio King',
        description: 'Walk 1000 meters.',
        type: 'walk_distance',
        targetAmount: 1000,
        progressProp: 'dist',
        reward: 300
    },
    {
        id: 'big_spender',
        title: 'Big Spender',
        description: 'Spend money 3 times on anything.',
        type: 'money_spent',
        targetAmount: 3,
        progressProp: null, // null means: increment by 1 for every event occurrence
        reward: 100
    },
    {
        id: 'lunch_break',
        title: 'Lunch Break',
        description: 'Consume 5 food or drink items.',
        type: 'consume_item',   // Matches the emit in inventory.js
        targetAmount: 5,
        progressProp: null,     // null = increment by 1 every time event fires
        reward: 100
    },
    {
        id: 'sanitation_hero',
        title: 'Sanitation Hero',
        description: 'Collect 20 bags of trash during the Garbage Job.',
        type: 'garbage_collect', // Matches the emit in garbage.js
        targetAmount: 20,
        progressProp: 'count',   // Uses { count: 1 } from the event data
        reward: 500
    },
    {
        id:           'catch_of_the_day',
        title:        'Catch of the Day',
        description:  'Catch 10 fish during the Fishing Job.',
        type:         'fishing_catch',
        targetAmount: 10,
        progressProp: 'count',
        reward:       600
    },
    {
        id:           'rare_catch',
        title:        'Trophy Fisher',
        description:  'Catch 1 rare fish.',
        type:         'fishing_catch',
        targetAmount: 1,
        progressProp: null,   // fires once per any catch — filter by rarity client side
        reward:       400
    }
];