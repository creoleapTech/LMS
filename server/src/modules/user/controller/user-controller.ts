import Elysia, { t } from "elysia";
import { BadRequestError } from "@/lib/shared/bad-request";
import { userAuthMacro } from "../user-macro";
import { convertTime } from "@/lib/timeConversion";
import { deleteFile, saveFile } from "@/lib/file";
import { IndustryModel } from "@/schema/admin/industries-model";
import { linkModel } from "@/schema/admin/link-model";
import { UserModel } from "@/schema/user/user-model";
import { Types } from "mongoose";
import { FollowModel } from "@/schema/user/follow-model";
import { ProfileVisitorModel } from "@/schema/user/profileVisit-model";

// Interface for SubCategory
interface SubCategory {
  name: string;
  icon?: string;
  isActive?: boolean;
}

// Interface for Category (Links)
interface Category extends Document {
  name: string;
  subCategories: SubCategory[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for Industry
interface Industry extends Document {
  title: string;
  image: string;
  tags: string[]; // Added tags field
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
// Interface for Create/Update Request Body
interface CategoryRequest {
  name: string;
  subCategories: SubCategory[];
  isActive?: boolean;
}

// Interface for Response
interface CategoryResponse {
  status: boolean;
  message: string;
  data?: Category | Category[];
}
// Interface for BusinessDetails
interface BusinessDetails {
  companyName: string;
  companyAddress: string;
  companyMobile: string;
  companyEmail: string;
  companyWebsite: string;
}

// Interface for SocialMedia
interface SocialMedia {
  facebook: string;
  x: string;
  whatsapp: string;
  youtube: string;
  instagram: string;
}

// Interface for User
interface User extends Document {
  username: string;
  email: string;
  role: string;
  profileImage?: string;
  lastLogin?: Date;
  isActive: boolean;
  permissions: string[];
  isDeleted: boolean;
  fcmToken?: string;
  mobile?: string;
  department?: string;
  slug?: string;
  businessDetails?: BusinessDetails;
  socialMedia?: SocialMedia;
  subscriptionPlan?: string;
  selectedIndustries: Types.ObjectId[]; // Reference to IndustryModel
  attachedLinks: Types.ObjectId[]; // Reference to linkModel
  businessImages: string[];
}


// User Controller
export const userController = new Elysia({
  prefix: "/user",
  tags: ["User"],
})
  .use(userAuthMacro)
  .guard({ isAuth: true })
  .get(
    "/details",
    async ({ query, set }) => {
      try {
        const { userId } = query;

        if (!userId) {
          throw new BadRequestError("User ID is required");
        }

        const existingUser = await UserModel.findOne({
          _id: userId,
          isDeleted: false,
        })
          // .populate("selectedIndustries")
          // .populate("attachedLinks");

        if (!existingUser) {
          throw new BadRequestError("User not found");
        }

        set.status = 200;
        const { _id, ...rest } = existingUser.toObject();
        return {
          status: true,
          message: "User retrieved successfully",
           data: {
    ...rest,
    userId: _id, // rename _id → userId
  },
        };
      } catch (error) {
        set.status = 400;
        return {
          status: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        summary: "Retrieve a user by user ID",
      },
      query: t.Object({
        userId: t.String(),
      }),
    }
  )
  .get(
    "/flags",
    async ({ query, set }) => {
      try {
        const { userId } = query;

        if (!userId) {
          throw new BadRequestError("User ID is required");
        }

        const existingUser = await UserModel.findOne({
          _id: userId,
          isDeleted: false,
        })
          .populate("selectedIndustries")
          .populate("attachedLinks") as any;

        if (!existingUser) {
          throw new BadRequestError("User not found");
        }

        // Define flags and check their status
        const businessDetailsFlag = !!(
          existingUser.businessDetails &&
          existingUser.businessDetails.companyName
        );

        const profilePictureFlag = !!existingUser.profileImage;

        const selectedIndustriesFlag =
          Array.isArray(existingUser.selectedIndustries) &&
          existingUser.selectedIndustries.length > 0;

        const attachedLinksFlag =
          Array.isArray(existingUser.attachedLinks) &&
          existingUser.attachedLinks.length > 0;

        const businessImagesFlag =
          Array.isArray(existingUser.businessImages) &&
          existingUser.businessImages.length > 0;

        set.status = 200;
        return {
          status: true,
          message: "User retrieved successfully",
          flags: {
            businessDetails: businessDetailsFlag,
            profilePicture: profilePictureFlag,
            selectedIndustries: selectedIndustriesFlag,
            attachedLinks: attachedLinksFlag,
            businessImages: businessImagesFlag,
          },
          data: {
            businessDetails: existingUser.businessDetails ?? {},
            profilePicture: existingUser.profileImage ?? "",
            selectedIndustries: existingUser.selectedIndustries ?? [],
            attachedLinks: existingUser.attachedLinks ?? [],
            businessImages: existingUser.businessImages ?? [],
          },
        };
      } catch (error) {
        set.status = 400;
        return {
          status: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        summary: "Retrieve a user by user ID and check specified flags",
      },
      query: t.Object({
        userId: t.String(),
      }),
    }
  )
.patch(
  "/business-details",
  async ({ query, body, set }) => {
    try {
      const { userId } = query;
      const { companyName, companyAddress, companyMobile, companyEmail, companyWebsite, companyLogo } = body;

      if (!userId || !companyName || !companyAddress || !companyMobile || !companyEmail || !companyWebsite) {
        throw new BadRequestError("User ID and all company details are required");
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new BadRequestError("User not found");
      }

      let logoFilename = user.businessDetails?.companyLogo;
      let oldLogo = user.businessDetails?.companyLogo;
      let uploadedNewFile = false;

      if (companyLogo) {
        const parentFolder = "company-logos";

        if (typeof companyLogo === "string") {
          // Just store the string directly (could be existing filename or external URL)
          logoFilename = companyLogo;
        } else {
          // Handle file upload
          const saveResult = await saveFile(companyLogo, parentFolder);

          if (!saveResult.ok || !saveResult.filename) {
            throw new BadRequestError("Failed to save company logo");
          }

          logoFilename = saveResult.filename;
          uploadedNewFile = true;
        }
      }

      const updatedBusinessDetails = {
        companyName,
        companyAddress,
        companyMobile,
        companyEmail,
        companyWebsite,
        companyLogo: logoFilename,
      };

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          businessDetails: updatedBusinessDetails,
          updatedAt: convertTime(),
        },
        { new: true }
      );

      if (!updatedUser) {
        // Cleanup uploaded file if DB update failed
        if (uploadedNewFile && logoFilename) {
          await deleteFile(logoFilename, "company-logos");
        }
        throw new BadRequestError("Failed to update business details");
      }

      // Delete old logo only if a new file replaced it
      if (uploadedNewFile && oldLogo) {
        const deleteResult = await deleteFile(oldLogo, "company-logos");
        if (!deleteResult.ok) {
          console.warn(`⚠️ Failed to delete old company logo: ${oldLogo}`);
        }
      }

      set.status = 200;
      return {
        status: true,
        message: "Business details updated successfully",
        data: updatedUser.businessDetails,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: {
      summary: "Update business details of a user",
      description:
        "Updates all business details including company logo (stores string directly if provided, or saves file if uploaded)",
    },
    query: t.Object({
      userId: t.String(),
    }),
    body: t.Object({
      companyName: t.String(),
      companyAddress: t.String(),
      companyMobile: t.String(),
      companyEmail: t.String(),
      companyWebsite: t.String(),
      companyLogo: t.Optional(t.Any()), 
    }),
  }
)

  .post(
    "/profile-image",
    async ({ query, body, set }) => {
      try {
        const { userId } = query;
        const { profileImage } = body;

        if (!userId || !profileImage) {
          throw new BadRequestError("User ID and profile image are required");
        }

        const user = await UserModel.findById(userId);
        if (!user) {
          throw new BadRequestError("User not found");
        }

        const parentFolder = "profile-images";
        const saveResult = saveFile(profileImage, parentFolder);
        if (!saveResult.ok || !saveResult.filename) {
          throw new BadRequestError("Failed to save profile image");
        }

        if (user.profileImage) {
          const deleteResult = await deleteFile(user.profileImage, parentFolder);
          if (!deleteResult.ok) {
            console.warn(`Failed to delete old profile image: ${user.profileImage}`);
          }
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
          userId,
          {
            profileImage: saveResult.filename,
            updatedAt: convertTime(),
          },
          { new: true }
        );

        if (!updatedUser) {
          await deleteFile(saveResult.filename, parentFolder);
          throw new BadRequestError("Failed to update user profile");
        }

        set.status = 200;
        return {
          status: true,
          message: "Profile image updated successfully",
        };
      } catch (error) {
        set.status = 400;
        return {
          status: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        summary: "Update profile image of a user",
        description: "Handles file upload for user profile image, deletes old image if exists, and updates user record",
      },
      query: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        profileImage: t.Any(),
      }),
    }
  )
.patch(
  "/selected-industries",
  async ({ query, body, set }) => {
    try {
      const { userId } = query;
      const { selectedIndustries } = body; // Expects: [{ industry: ObjectId, tags: string[] }]

      if (!userId || !selectedIndustries) {
        throw new BadRequestError("User ID and selected industries are required");
      }

      // Validate industries exist
      const industryIds = selectedIndustries.map((item: any) => item.industry);
      const industriesExist = await IndustryModel.find({ _id: { $in: industryIds } });
      if (industriesExist.length !== industryIds.length) {
        throw new BadRequestError("One or more industries not found");
      }

      // Update the user's selectedIndustries (replaces the entire array)
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { selectedIndustries }, // Directly assign the new array
        { new: true }
      ).populate("selectedIndustries.industry");

      if (!updatedUser) {
        throw new BadRequestError("User not found");
      }

      set.status = 200;
      return {
        status: true,
        message: "Selected industries updated successfully",
        data: updatedUser.selectedIndustries,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Update selected industries of a user" },
    query: t.Object({ userId: t.String() }),
    body: t.Object({
      selectedIndustries: t.Array(
        t.Object({
          industry: t.String(), // ObjectId as string
          tags: t.Array(t.String())
        })
      )
    }),
  }
)

.patch(
  "/attached-links",
  async ({ query, body, set }) => {
    try {
      const { userId } = query;
      const { attachedLinks } = body;

      if (!userId || !attachedLinks) {
        throw new BadRequestError("User ID and attached links are required");
      }

      // Validate categories exist
      const categoryIds = attachedLinks.map((item: any) => item.category);
      const categoriesExist = await linkModel.find({ _id: { $in: categoryIds } });
      if (categoriesExist.length !== categoryIds.length) {
        throw new BadRequestError("One or more categories not found");
      }

      // Validate subcategories exist and belong to their parent category
      for (const link of attachedLinks) {
        const category = await linkModel.findById(link.category);
        if (!category) continue;

        for (const sub of link.subCategories) {
          const subExists = category.subCategories.some(
            (sc: any) => sc._id.toString() === sub.subCategoryId.toString()
          );
          if (!subExists) {
            throw new BadRequestError(
              `Subcategory ${sub.subCategoryId} not found in category ${link.category}`
            );
          }
        }
      }

      // Update the user's attachedLinks
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { attachedLinks },
        { new: true }
      ).populate({
        path: 'attachedLinks.category',
        model: 'Links'
      });

      if (!updatedUser) {
        throw new BadRequestError("User not found");
      }

      set.status = 200;
      return {
        status: true,
        message: "Attached links updated successfully",
        data: updatedUser.attachedLinks,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Update attached links of a user" },
    query: t.Object({ userId: t.String() }),
    body: t.Object({
      attachedLinks: t.Array(
        t.Object({
          category: t.String(), // Category ObjectId
          subCategories: t.Array(
            t.Object({
              subCategoryId: t.String(), // SubCategory ObjectId
              url: t.String()           // URL for the subcategory
            })
          )
        })
      )
    }),
  }
)

.patch(
  "/business-images",
  async ({ query, body, set }) => {
    try {
      const { userId } = query;
      const { businessImages } = body;

      if (!userId || !businessImages || !Array.isArray(businessImages)) {
        throw new BadRequestError("User ID and business images array are required");
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new BadRequestError("User not found");
      }

      const parentFolder = "business-images";
      const savedFilenames: string[] = [];
      const oldFilenames = user.businessImages || [];

      // Process each image in the businessImages array
      for (const image of businessImages) {
        let filename: string;

        if (typeof image === 'string') {
          // If image is a string, store it directly
          filename = image;
        } else {
          // Assume image is a file and needs to be converted
          const saveResult = await saveFile(image, parentFolder);
          if (!saveResult.ok || !saveResult.filename) {
            // Clean up any already saved files if one fails
            for (const savedFilename of savedFilenames) {
              if (savedFilename !== image) { // Only delete if it was a file, not a string
                await deleteFile(savedFilename, parentFolder);
              }
            }
            throw new BadRequestError("Failed to save business image");
          }
          filename = saveResult.filename;
        }
        savedFilenames.push(filename);
      }

      // Update user with new image filenames
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { 
          businessImages: savedFilenames,
          updatedAt: convertTime(),
        },
        { new: true }
      );

      if (!updatedUser) {
        // Clean up new images if update failed
        for (const filename of savedFilenames) {
          if (businessImages[savedFilenames.indexOf(filename)] !== filename) { // Only delete if it was a file
            await deleteFile(filename, parentFolder);
          }
        }
        throw new BadRequestError("Failed to update business images");
      }

      // Delete old images after successful update
      for (const oldFilename of oldFilenames) {
        const deleteResult = await deleteFile(oldFilename, parentFolder);
        if (!deleteResult.ok) {
          console.warn(`Failed to delete old business image: ${oldFilename}`);
        }
      }

      set.status = 200;
      return {
        status: true,
        message: "Business images updated successfully",
        data: updatedUser.businessImages ?? [],
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: {
      summary: "Update business images of a user",
      description: "Handles both direct string storage and file upload/replacement for business images, with cleanup of old images",
    },
    query: t.Object({
      userId: t.String(),
    }),
    body: t.Object({
      businessImages: t.Array(t.Any()), // Accepts both strings and files
    }),
  }
)

  .get(
    "/industries",
    async ({ set }) => {
      try {
        const industries = await IndustryModel.find().sort({ createdAt: -1 });

        set.status = 200;
        return {
          success: true,
          message: "Industries fetched successfully",
          data: industries,
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        summary: "Get All Industries",
        description: "Fetch a list of all industries with their images and tags",
      },
    }
  )
  .get(
  "/links",
  async ({ set }) => {
    try {
      // Fetch all categories with subcategories, sorted by creation date (newest first)
      const links = await linkModel
        .find({ isActive: true }) // Optional: Only active categories
        .sort({ createdAt: -1 })
        .lean();

      set.status = 200;
      return {
        success: true,
        message: "Links fetched successfully",
        data: links,
      };
    } catch (error) {
      set.status = 500;
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: {
      summary: "Get All Links",
      description: "Fetch a list of all categories and their subcategories (e.g., Social, Technology)",
    },
  }
)

  .patch(
    "/industry-tags",
    async ({ query, body, set }) => {
      try {
        const { industryId } = query;
        const { tags } = body;

        if (!industryId || !tags) {
          throw new BadRequestError("Industry ID and tags are required");
        }

        const updatedIndustry = await IndustryModel.findByIdAndUpdate(
          industryId,
          { tags },
          { new: true }
        );

        if (!updatedIndustry) {
          throw new BadRequestError("Industry not found");
        }

        set.status = 200;
        return {
          status: true,
          message: "Industry tags updated successfully",
          data: updatedIndustry.tags,
        };
      } catch (error) {
        set.status = 400;
        return {
          status: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        summary: "Update tags for an industry",
      },
      query: t.Object({
        industryId: t.String(),
      }),
      body: t.Object({
        tags: t.Array(t.String()),
      }),
    }
  )

.post(
  "/follow",
  async ({ query, set }) => {
    try {
      const { followerId, followingId } = query;

      if (!followerId || !followingId) {
        throw new BadRequestError("Follower ID and Following ID are required");
      }

      if (followerId === followingId) {
        throw new BadRequestError("You cannot follow yourself");
      }

      // Check if follow already exists
      const existingFollow = await FollowModel.findOne({
        follower: followerId,
        following: followingId,
      });

      if (existingFollow) {
        throw new BadRequestError("Already following this user");
      }

      // Create follow record
      await FollowModel.create({
        follower: followerId,
        following: followingId,
        status: "active",
      });

      set.status = 200;
      return {
        status: true,
        message: "User followed successfully",
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Follow a user" },
    query: t.Object({
      followerId: t.String(),
      followingId: t.String(),
    }),
  }
)
.delete(
  "/unfollow",
  async ({ query, set }) => {
    try {
      const { followerId, followingId } = query;

      if (!followerId || !followingId) {
        throw new BadRequestError("Follower ID and Following ID are required");
      }

      const follow = await FollowModel.findOneAndDelete({
        follower: followerId,
        following: followingId,
      });

      if (!follow) {
        throw new BadRequestError("Not following this user");
      }

      set.status = 200;
      return {
        status: true,
        message: "Unfollowed user successfully",
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Unfollow a user" },
    query: t.Object({
      followerId: t.String(),
      followingId: t.String(),
    }),
  }
)
.get(
  "/follow-stats",
  async ({ query, set }) => {
    try {
      const { userId } = query;

      if (!userId) {
        throw new BadRequestError("User ID is required");
      }

      // Count followers and followings
      const followersCount = await FollowModel.countDocuments({
        following: userId,
        status: "active",
      });

      const followingCount = await FollowModel.countDocuments({
        follower: userId,
        status: "active",
      });

      set.status = 200;
      return {
        status: true,
        message: "Follow stats retrieved successfully",
        data: {
          followers: followersCount,
          following: followingCount,
        },
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Get follower & following count for a user" },
    query: t.Object({
      userId: t.String(),
    }),
  }
)
.get(
  "/followers",
  async ({ query, set }) => {
    try {
      const { userId, search } = query;

      if (!userId) {
        throw new BadRequestError("User ID is required");
      }

      // Find all followerIds (users who follow this user)
      const follows = await FollowModel.find({ following: userId, status: "active" })
        .select("follower -_id")
        .lean();

      const followerIds = follows.map(f => f.follower);

      // Optimized: Fetch only needed user fields
      const searchFilter = search
        ? {
            _id: { $in: followerIds },
            $or: [
              { username: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : { _id: { $in: followerIds } };

      const followers = await UserModel.find(searchFilter)
        .select("username email profileImage role") // limit fields
        .lean();

      set.status = 200;
      return {
        status: true,
        message: "Followers fetched successfully",
        data: followers,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Get list of followers" },
    query: t.Object({
      userId: t.String(),
      search: t.Optional(t.String()),
    }),
  }
)
.get(
  "/following",
  async ({ query, set }) => {
    try {
      const { userId, search } = query;

      if (!userId) {
        throw new BadRequestError("User ID is required");
      }

      // Find all followingIds (users this user follows)
      const follows = await FollowModel.find({ follower: userId, status: "active" })
        .select("following -_id")
        .lean();

      const followingIds = follows.map(f => f.following);

      const searchFilter = search
        ? {
            _id: { $in: followingIds },
            $or: [
              { username: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : { _id: { $in: followingIds } };

      const following = await UserModel.find(searchFilter)
        .select("username email profileImage role")
        .lean();

      set.status = 200;
      return {
        status: true,
        message: "Following fetched successfully",
        data: following,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Get list of following" },
    query: t.Object({
      userId: t.String(),
      search: t.Optional(t.String()),
    }),
  }
)
.post(
  "/profile-visit",
  async ({ query, set }) => {
    try {
      const { viewerId, profileId } = query;

      if (!profileId) {
        throw new BadRequestError("Profile ID is required");
      }

      if (viewerId === profileId) {
        throw new BadRequestError("You cannot visit your own profile");
      }

      // Check if viewer has already visited this profile
      const existingVisit = await ProfileVisitorModel.findOne({ profileId, viewerId });

      if (!existingVisit) {
        // Record new visit
        await ProfileVisitorModel.create({ profileId, viewerId });

        // Increment unique profile views
        await UserModel.findByIdAndUpdate(profileId, {
          $inc: { profileViews: 1 },
        });
      } else {
        // Update last visit timestamp
        existingVisit.visitedAt = new Date();
        await existingVisit.save();
      }

      const updatedUser = await UserModel.findById(profileId)
        .select("username email profileViews")
        .lean();

      if (!updatedUser) {
        throw new BadRequestError("Profile not found");
      }

      set.status = 200;
      return {
        status: true,
        message: "Profile visit recorded",
        data: {
          profileId,
          profileViews: updatedUser.profileViews,
        },
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Record a profile visit" },
    query: t.Object({
      profileId: t.String(),
      viewerId: t.String(),
    }),
  }
)
.get(
  "/profile-stats",
  async ({ query, set }) => {
    try {
      const { userId } = query;
      if (!userId) throw new BadRequestError("User ID is required");

      const user = await UserModel.findById(userId)
        .select("username email profileViews profileVisitors")
        .populate("profileVisitors.userId", "username email profileImage")
        .lean();

      if (!user) throw new BadRequestError("User not found");

      set.status = 200;
      return {
        status: true,
        message: "Profile stats retrieved",
        data: user,
      };
    } catch (error) {
      set.status = 400;
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: { summary: "Get profile stats" },
    query: t.Object({
      userId: t.String(),
    }),
  }
)