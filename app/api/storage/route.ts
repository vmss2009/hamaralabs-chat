import { NextResponse } from 'next/server';
import s3 from '../../../lib/storage/storage';
import { ListBucketsCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export async function GET() {
    try {
        const result = await s3.send(new ListBucketsCommand({}));
        const buckets = result.Buckets?.map(b => b.Name) ?? [];
        console.log("✅ S3 connection successful. Buckets:", buckets);
        return NextResponse.json({ success: true, buckets });
    } catch (err: any) {
        console.error("❌ S3 connection failed:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}