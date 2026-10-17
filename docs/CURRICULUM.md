# Curriculum audit and interactive coverage

Verified visually and by text extraction against **Curriculum Specifications (CS) Physics SP025.pdf**, printed page 6, “Topic 1: Electrostatics”, effective from session 2022/2023. The supplied file was read from `C:/Users/User/Downloads/Telegram Desktop/Curriculum Specifications (CS) Physics SP025.pdf`; it was not modified or bundled with the application.

The document confirms the prompt's four subtopics. Force, field and potential systems allow a maximum of four point charges in 2D. System potential energy is restricted to three. Chapter 2 capacitors, dielectrics and RC charging are excluded.

| Outcome | Genuine interactive activity | Validation check |
| --- | --- | --- |
| 1.1(a) State Coulomb's law | Edit signed charges and separation; inspect the law, constant and substitution in Calculations | Reference A; inverse-square and sign-reversal tests |
| 1.1(b) Sketch an electric force diagram | Select a target; drag sources; toggle components and free-body diagram | Attraction/equal-and-opposite vector test; browser target dragging and preset regression |
| 1.1(c) Apply to up to four charges | Pair, triangle and square presets; add/remove and select target | Independent three/four-source and 3-4-5 component tests; four-source UI limit |
| 1.2(a) Define/use E = F/q₀ | Change signed test charge at a fixed probe; compare unchanged E with changed F | Reference B; zero-charge test; live test-charge-force challenge regression |
| 1.2(b) Point-source E = kQ/r² | Single positive/negative source, draggable probe and precise coordinates | Reference B; signed-field direction and dense-sampler reference tests |
| 1.2(c) Sketch field diagrams | Switch integrated field lines, direction arrows and vector grid for each preset | Responsive field screenshots; complete preset regression; correct signed vector references |
| 1.2(d) Field superposition, up to four charges | Compare per-source components at A; find the zero-field point | Symmetry/cancellation and four-source tests; browser zero-field measurement |
| 1.3(a) Define V = W/q₀ | Move A/B and edit test q; compare potential with quasistatic external work | References C and E; live potential/work challenge checks |
| 1.3(b)(i) Isolated-charge equipotentials | Positive/negative single-source contours; move probes along a circle | Independent equal-radius potential-difference test; potential screenshots |
| 1.3(b)(ii) Uniform-field equipotentials | Load the uniform-field investigation, move B and change signed Eᵧ | Uniform-mode guided/browser regression; signed uniform-field reference F |
| 1.3(c) Point/system potential, up to four | Drag sources, compare scalar contributions and field at midpoint | Reference C; negative potential test; every charge preset in browser |
| 1.3(d) Potential difference | Move A and B; predict V_B − V_A; compare W_ext and W_field | Equal-potential difference test; live ΔV challenge regression |
| 1.3(e) ΔU = qΔV | Change signed test charge and move A/B | Reference E and sign reversal; energy/work challenge regression |
| 1.3(f) System potential energy, up to three | Triangle preset with each distinct pair shown; four-source explanatory guard | Reference D; independently calculated three-pair sum; source-limit test |
| 1.4(a)(i) Initially stationary charge | Experiment A, Play/Step and signed-force edits | Reference G equations; from-rest collision and displacement tests; all motion presets in browser |
| 1.4(a)(ii) Perpendicular motion | Experiment B, parabolic trace, v components and exit behaviour | Reference G; analytic field-exit continuity; browser play/pause/step |
| 1.4(a)(iii) Parallel motion | Experiment C, opposing vᵧ and acceleration, sign edits | Independent stopping/reversal test; live velocity/displacement challenges |
| 1.4(a)(iv) Dynamic equilibrium | Experiment D, nonzero horizontal velocity; gravity and electric-force arrows | Balanced qE = mg test; browser equilibrium interpretation; post-exit gravity test |
| 1.4(b) Uniform-field E = ΔV/d | Signed voltage and separation inputs; labelled positive/negative plates | Reference F; signed-field direction, invalid separation and boundary tests |

There are **12 guided investigations** and **20 live challenges** (5 / 4 / 5 / 6 across tabs 1.1–1.4). Answers evaluate the current simulation state. The workflow is Predict → Simulate → Observe → Explain, with a prediction input, check/reveal, optional hint, explanation and the live worked calculation.

The syllabus's work convention is made explicit: `W_ext = qΔV` for quasistatic external work; `W_field = −qΔV`. Equipotential circles and parallel lines are described as 2D sections of spherical surfaces and planes, respectively.
