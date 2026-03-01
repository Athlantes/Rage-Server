# Dimension Management 🌐

This document tracks the dimension routing used across the server. Keeping track of dimensions is critical to ensure systems do not overlap (e.g., players customizing a car shouldn't suddenly see someone logging in).

## Current Dimension Allocations

| Dimension Range | System | Description | File Reference |
| :--- | :--- | :--- | :--- |
| `0` | **Overworld / Global** | The main open-world dimension. Streets, exteriors, blips, public markers, and normal gameplay occur here. | Multiple (e.g., `playerManager.js`, `houseManager.js`) |
| `1` to `1999` *(Dynamic)* | **House Interiors & Family HQs** | Used for house interiors. The dimension ID perfectly matches the House's Database ID. | `packages/systems/houseManager.js` |
| `2000 + player.id` | **Auth / Login Screen** | Isolates the player immediately upon joining the server while they are looking at the login/register UI. | `packages/core/auth.js` |
| `10000 + player.id` | **Tuning Shops** | Private dimension used to isolate a player and their vehicle while they are actively navigating the tuning menu. | `packages/systems/tuning.js` |
| `OFFSET + player.id` | **Dealerships** | Isolates players while they are browsing vehicles, previewing cars, or doing a 60-second Test Drive. *(Offset defined in `dealershipCatalog.js`)* | `packages/systems/dealership.js` |

---

## Detailed System Breakdown

### 1. Overworld (Dim 0)
Everything spawned outside relies on dimension `0`. 
* **Important:** When deleting or creating temporary vehicles/objects in the overworld, always explicitly set their dimension to `0`.

### 2. Properties & Houses (`houseData.id`)
* **Logic:** When a player enters a house, `player.dimension = house.id`.
* **Conflict Warning:** If your database ever reaches **2,000 houses**, house dimensions will begin to collide with the Auth/Login dimensions (`2000 + player.id`). 
* **Fix (If you plan to have >2000 houses):** Change the Auth offset in `auth.js` from `2000` to something much higher, like `50000`.

### 3. Personal Instances (`Offset + player.id`)
Many systems assign a private dimension by taking a massive base number and adding the player's server ID. 
* **Tuning:** `10000 + player.id`
* **Auth:** `2000 + player.id`
* **Dealership:** Uses `DEALERSHIP_DIM_OFFSET + player.id`

---

## Guidelines for Creating New Systems

When creating a new system that requires isolation (e.g., a Clothing Store preview, an Arena Minigame, or an Apartment Garage), follow these rules to avoid collisions:

1. **For Player-Specific Isolation (e.g., UI Previews):**
   Use a new, unused 10k block offset. 
   * *Example for a new Clothing Store:* `const CLOTHING_DIM = 20000 + player.id;`
   * *Example for a new Barber Shop:* `const BARBER_DIM = 30000 + player.id;`

2. **For Instance-Specific Isolation (e.g., Businesses, Garages, Dungeons):**
   Use the Database ID of that instance, but apply a massive offset so it doesn't collide with Houses (which start at 1).
   * *Example for Private Garages:* `const GARAGE_DIM = 100000 + garage.id;`
   * *Example for Businesses:* `const BIZ_DIM = 200000 + business.id;`

3. **Always Restore the Original Dimension:**
   If pulling a player out of Dimension `0` into a private dimension, always save their previous dimension to a temporary variable so you can put them back exactly where they were.
   ```javascript
   // Good Practice
   player.data.previousDim = player.dimension;
   player.dimension = 20000 + player.id;
   
   // ... later when they close the menu ...
   player.dimension = player.data.previousDim;
   ```