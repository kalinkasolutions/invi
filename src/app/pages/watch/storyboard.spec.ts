import { frameAt, parseStoryboard } from './storyboard';

const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
https://invidious.example.com/sb/i/abc/storyboard3_L2/M0.jpg?sqp=x%3D&sigh=y#xywh=0,0,158,90

00:00:02.000 --> 00:00:04.000
https://invidious.example.com/sb/i/abc/storyboard3_L2/M0.jpg?sqp=x%3D&sigh=y#xywh=160,0,158,90

01:00:04.000 --> 01:00:06.500
/sb/i/abc/storyboard3_L2/M1.jpg?sqp=x#xywh=0,90,158,90
`;

describe('parseStoryboard', () => {
  it('reads times, the sprite cut-out, and keeps only the path of the image', () => {
    const frames = parseStoryboard(vtt);
    expect(frames).toHaveLength(3);
    expect(frames[1]).toEqual({
      start: 2,
      end: 4,
      image: '/sb/i/abc/storyboard3_L2/M0.jpg?sqp=x%3D&sigh=y',
      x: 160,
      y: 0,
      width: 158,
      height: 90,
    });
    expect(frames[2]).toMatchObject({ start: 3604, end: 3606.5, image: '/sb/i/abc/storyboard3_L2/M1.jpg?sqp=x', y: 90 });
  });

  it('finds nothing in an empty answer', () => {
    expect(parseStoryboard('WEBVTT\n')).toEqual([]);
  });
});

describe('frameAt', () => {
  const frames = parseStoryboard(vtt);

  it('picks the frame covering the time, and the last one past the end', () => {
    expect(frameAt(frames, 0)?.x).toBe(0);
    expect(frameAt(frames, 3.9)?.x).toBe(160);
    expect(frameAt(frames, 99999)?.y).toBe(90);
    expect(frameAt([], 5)).toBeUndefined();
  });
});
