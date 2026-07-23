# Execution Lock — 斗地主 Modern Pixel

## canvas
- base_size: 64x64
- tile_size: 64x64
- format: RGBA PNG

## palette
- name: ddz-gold-green
- colors:
  - #0b2218
  - #14352a
  - #1b4a37
  - #2a6349
  - #e8bc3a
  - #c49218
  - #d63031
  - #a82020
  - #fbfbf6
  - #1c1c1c
  - #6b4424
  - #8a5c34
  - #43301f
  - #241612
  - #fff3c4
  - #4a90d9

## style
- sub_style: cel-shaded
- outline_color: #0b2218
- shading: 3-tone
- dithering: none
- light_direction: top-left

## per_sprite_budget
- max_colors: 16

## assets
- characters:
  - name: landlord_character
    size: 96x96
    colors: all
    animations: none
  - name: farmer_character
    size: 72x72
    colors: all
    animations: none
- tiles:
  - name: felt_texture
    size: 64x64
    colors: [#0b2218, #14352a, #1b4a37, #2a6349]
    animations: none
  - name: rail_texture
    size: 64x64
    colors: [#4a2e18, #6b4424, #8a5c34, #fff3c4]
    animations: none
- ui:
  - name: card_front_template
    size: 52x74
    colors: [#fbfbf6, #1c1c1c, #d63031, #0b2218]
    animations: none
  - name: card_back
    size: 52x74
    colors: [#a82020, #d63031, #e8bc3a, #c49218]
    animations: none
  - name: joker_small
    size: 52x74
    colors: all
    animations: none
  - name: joker_big
    size: 52x74
    colors: all
    animations: none
  - name: badge_landlord
    size: 28x28
    colors: [#e8bc3a, #d63031, #c49218, #0b2218]
    animations: none
  - name: badge_farmer
    size: 24x24
    colors: [#2a6349, #1b4a37, #e8bc3a, #0b2218]
    animations: none
  - name: double_badge
    size: 60x60
    colors: all
    animations: none
  - name: victory_badge
    size: 90x70
    colors: all
    animations: none
  - name: defeat_badge
    size: 90x70
    colors: all
    animations: none
  - name: btn_primary
    size: 120x40
    colors: [#e8bc3a, #c49218, #fff3c4, #0b2218]
    animations: none
- effects:
  - name: bomb
    size: 80x60
    colors: all
    animations: none
  - name: spring
    size: 80x60
    colors: all
    animations: none
- backgrounds:
  - name: room_bg
    size: 320x180
    colors: [#43301f, #241612, #0b2218]
    animations: none
  - name: lobby_hero
    size: 360x160
    colors: all
    animations: none

## forbidden
- Anti-aliasing
- Gradient fills
- Partial opacity (1-254 alpha)
- Colors outside declared palette
- Sub-pixel rendering
