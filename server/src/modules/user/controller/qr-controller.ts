import { Elysia, t } from "elysia";
import QRCode from "qrcode";
import sharp from 'sharp'; // Use sharp instead
import { BadRequestError } from "@/lib/shared/bad-request";
import { userAuthMacro } from "../user-macro";

import { promises as fs } from "fs";
import path from "path";
import { UserModel } from "@/schema/user/user-model";

// Interface for QR Response
interface QRResponse {
  status: boolean;
  message: string;
  qrCode?: string;
  userData?: string;
  filePath?: string;
}

const PLACEHOLDER_IMAGE_PATH = path.join(__dirname, 'qrcodes', 'user-dummy.jpeg');

export const qrController = new Elysia({
  prefix: "/qr",
  tags: ["QR"],
})
.get(
  "/generate/:userId",
  async ({ params: { userId }, query: { save }, set }) => {
    try {
      if (!userId) {
        throw new BadRequestError("User ID is required");
      }

      const user = await UserModel.findById(userId)
        .select("username email mobile businessDetails selectedIndustries attachedLinks profileImage slug")
        .populate({
          path: "selectedIndustries.industry",
          model: "Industry",
        })
        .populate({
          path: "attachedLinks.category",
          model: "Links",
        });

      if (!user) {
        throw new BadRequestError("User not found");
      }

      if (!user.slug) {
  throw new BadRequestError("Please fill all the details to generate the QR code. Slug is missing.");
}

      const profileSlug = user.slug || user.username.toLowerCase().replace(/\s+/g, '-');
      const qrData = `https://kingschic.com/profile?slug=${profileSlug}`;

      let logoPath: string;
      if (user.profileImage) {
        logoPath = user.profileImage.startsWith('http') 
          ? await downloadImage(user.profileImage, `temp_${userId}.jpg`)
          : user.profileImage;
      } else {
        logoPath = PLACEHOLDER_IMAGE_PATH;
      }

      const qrBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: "H",
        type: "png",
        quality: 0.92,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        width: 256,
      });

      // Use sharp instead of Jimp
      const qrImage = sharp(qrBuffer);
      const logoImage = sharp(logoPath);

      const logoSize = Math.floor(256 * 0.2); // 20% of QR size

      // Create circular mask for the logo
      const circleSvg = Buffer.from(
        `<svg><circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="black"/></svg>`
      );

      const logoResized = await logoImage
        .resize(logoSize, logoSize, { fit: 'cover' })
        .composite([{
          input: circleSvg,
          blend: 'dest-in'
        }])
        .toBuffer();

      const x = Math.floor((256 - logoSize) / 2);
      const y = Math.floor((256 - logoSize) / 2);

      const finalImage = await qrImage
        .composite([{ input: logoResized, top: y, left: x }])
        .png()
        .toBuffer();

      const qrBase64 = `data:image/png;base64,${finalImage.toString('base64')}`;

      const response: QRResponse = {
        status: true,
        message: "QR code generated successfully",
        qrCode: qrBase64,
        userData: qrData,
      };

      if (save === "true") {
        const qrDir = path.join(__dirname, "qrcodes");
        const fileName = `qr_${userId}_${Date.now()}.png`;
        const filePath = path.join(qrDir, fileName);

        try {
          await fs.mkdir(qrDir, { recursive: true });
        } catch (error) {
          throw new Error("Failed to create QR code directory");
        }

        // Save the final image
        await fs.writeFile(filePath, finalImage);
        response.filePath = filePath;
        response.message = "QR code generated and saved successfully";
      }

      set.status = 200;
      return response;
    } catch (error) {
      set.status = error instanceof BadRequestError ? 400 : 500;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: {
      summary: "Generate QR code for a user",
      description: "Generates a QR code containing the user's profile URL (using slug) as a base64 PNG data URI with profile image (or placeholder) overlaid in the center. Optionally saves it as a PNG file to the local filesystem if save=true.",
    },
    params: t.Object({
      userId: t.String({
        pattern: "^[0-9a-fA-F]{24}$",
        error: "Invalid user ID format",
      }),
    }),
    query: t.Object({
      save: t.Optional(t.String({ pattern: "^(true|false)$" })),
    }),
  }
);

async function downloadImage(url: string, filename: string): Promise<string> {
  const https = require('https');
  const fs = require('fs');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    https.get(url, (response: { pipe: (arg0: any) => void; }) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filename);
      });
    }).on('error', (err: any) => {
      fs.unlink(filename, () => {});
      reject(err);
    });
  });
}