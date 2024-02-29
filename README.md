# minecraft

This is the final project for CS 174A: introduction to 3D graphics. Our project is a simplified remake of the famous game Minecraft by Mojang Studios.

A live demo can be found [here](https://adammuzz.github.io/minecraft/)

## Project Objective

The primary objective of this project is to develop a basic but functional version of a Minecraft-esque environment, emphasizing the fundamentals of computer graphics. This includes understanding and implementing 3D rendering, user interactivity, collision detection, and random generation of landscapes similar to the original game.

## Key Features

#### Random World Generation 
1. Each time the simulation is reloaded, the terrain of the world will be randomized with Perlin noise so that each time the user plays they will have a new experience.
2. Uses translations and scaling to place the block objects in the scene.
3. Uses texturing to detail world’s blocks as materials (grass and stone).
4. Uses special form of random noise (Perlin noise) to create smooth and continuous landscapes.

#### Environment Lighting
1. The world features a sun that lights up the environment during the day, and night time where just ambient light illuminates the world.
2. Uses the Phong shader lighting model to illuminate scene.
3. Implemented sun and moon objects that orbit around the player as they explore the world.

#### First Person Interactivity
1. Implemented perspective rendering to render 3D space from player’s POV.
2. The player can rotate camera angle & place/destroy blocks via mouse controls.
3. The player can move around world via keyboard input.

#### Face Culling
1. Uses backface culling to eliminate 1/2 of polygons before render
2. Further implemented algorithm which builds a bitmap of world’s voxels to create surface mesh of visible blocks.
3. These internal blocks do not need to be displayed so can be culled, further improving performance.
