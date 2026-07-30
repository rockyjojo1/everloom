# KayKit Knight Character - Animation Clips

## Summary
- **Total Animations**: 76 clips
- **Character Model**: Knight.glb (3.6 MB)
- **Model Source**: KayKit Character Pack Adventures v1.0 (CC0)
- **Current P0 Animation**: Idle (generic idle pose)

## Full Animation Clip List

### Idle Animations
- `Idle` - Generic idle stance (CURRENTLY PLAYING IN P0)
- `2H_Melee_Idle` - Two-handed weapon idle
- `Unarmed_Idle` - Unarmed idle
- `Unarmed_Pose`
- `T-Pose`
- `Jump_Idle`

### Movement
- `Walking_A` - Walking animation variant A
- `Walking_B` - Walking animation variant B
- `Walking_Backwards` - Walking backwards
- `Walking_C` - Walking animation variant C
- `Running_A` - Running animation variant A
- `Running_B` - Running animation variant B
- `Running_Strafe_Left` - Strafing left while running
- `Running_Strafe_Right` - Strafing right while running

### Jumping
- `Jump_Full_Long` - Long jump
- `Jump_Full_Short` - Short jump
- `Jump_Land` - Landing from jump
- `Jump_Start` - Jump startup

### One-Handed Combat (1H)
- `1H_Melee_Attack_Chop`
- `1H_Melee_Attack_Slice_Diagonal`
- `1H_Melee_Attack_Slice_Horizontal`
- `1H_Melee_Attack_Stab`
- `1H_Ranged_Aiming`
- `1H_Ranged_Reload`
- `1H_Ranged_Shoot`
- `1H_Ranged_Shooting`

### Two-Handed Combat (2H)
- `2H_Melee_Attack_Chop`
- `2H_Melee_Attack_Slice`
- `2H_Melee_Attack_Spin`
- `2H_Melee_Attack_Spinning`
- `2H_Melee_Attack_Stab`
- `2H_Ranged_Aiming`
- `2H_Ranged_Reload`
- `2H_Ranged_Shoot`
- `2H_Ranged_Shooting`

### Dual Wield Combat
- `Dualwield_Melee_Attack_Chop`
- `Dualwield_Melee_Attack_Slice`
- `Dualwield_Melee_Attack_Stab`

### Defense
- `Block`
- `Block_Attack`
- `Block_Hit`
- `Blocking`
- `Dodge_Backward`
- `Dodge_Forward`
- `Dodge_Left`
- `Dodge_Right`

### Damage & Death
- `Hit_A` - Take damage animation A
- `Hit_B` - Take damage animation B
- `Death_A` - Death animation A
- `Death_A_Pose` - Death pose A
- `Death_B` - Death animation B
- `Death_B_Pose` - Death pose B

### Sitting
- `Sit_Chair_Down` - Sit on chair startup
- `Sit_Chair_Idle` - Sitting on chair idle
- `Sit_Chair_Pose` - Sitting on chair pose
- `Sit_Chair_StandUp` - Stand up from chair
- `Sit_Floor_Down` - Sit on floor startup
- `Sit_Floor_Idle` - Sitting on floor idle
- `Sit_Floor_Pose` - Sitting on floor pose
- `Sit_Floor_StandUp` - Stand up from floor

### Lying Down
- `Lie_Down` - Lie down startup
- `Lie_Idle` - Lying idle
- `Lie_Pose` - Lying pose
- `Lie_StandUp` - Stand up from lying

### Interactions
- `Interact` - Generic interact animation
- `PickUp` - Pick up object animation
- `Use_Item` - Use item animation
- `Throw` - Throw animation
- `Cheer` - Celebration/cheer animation

### Spellcasting
- `Spellcast_Long` - Long spellcast
- `Spellcast_Raise` - Raise hands for spell
- `Spellcast_Shoot` - Shoot spell projectile
- `Spellcasting` - Generic spellcasting

## P1+ Implementation Notes

For P1 and beyond, the following animation clips are immediately available:

- **Walking**: Walking_A, Walking_B, Walking_Backwards (for A* pathfinding)
- **Running**: Running_A, Running_B, Running_Strafe_* (for sprint/dodge)
- **Combat Attack**: All 1H_Melee_Attack_*, 2H_Melee_Attack_*, Unarmed_Melee_Attack_*
- **Combat Defense**: Block, Dodge_*, Hit_A, Hit_B
- **Death**: Death_A, Death_B
- **Interaction**: Interact, PickUp, Use_Item (for objects, gathering, production)

The animation system supports smooth transitions between states using Three.js AnimationMixer's action system. Each clip can be triggered, looped, blended, or chained via the mixer API.
